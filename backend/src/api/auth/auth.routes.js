import Joi from 'joi';

import { Router } from 'express';
import { createAuthController } from './auth.controller.js';
import { requireAuthenticated } from '../middleware/authorization.middleware.js';
import { createRateLimiter, passThrough } from '../middleware/rate-limit.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { AuthErrorCode, authError } from '../../application/auth/auth-errors.js';

import externalAuthRouterFactory from './external-auth.routes.js';

const email = Joi.string().trim().lowercase().email().max(254).required();
// The maximum only protects against huge inputs; the real policy is applied in the service.
const password = Joi.string().max(256).required();

// Single-use opaque tokens (password reset, activation invitation): 256 bits in base64url.
const token = Joi.string()
  .pattern(/^[A-Za-z0-9_-]{43}$/)
  .required()
  .messages({ 'string.pattern.base': '"token" is invalid' }); // never echo the value

const schemas = {
  login: Joi.object({ email, password }),
  forgot: Joi.object({ email }),
  reset: Joi.object({ token, newPassword: password }),
  change: Joi.object({ currentPassword: password, newPassword: password }),
  activationInspect: Joi.object({ token }),
  activationLocal: Joi.object({ token, newPassword: password }),
};

/** Joi validation with a stable code. Joi messages do not include the values sent. */
function validateBody(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(
        new AppError('Validation failed', 400, joiDetails(error), AuthErrorCode.VALIDATION_FAILED),
      );
    }
    req.body = value;
    next();
  };
}

/** CSRF on the cookie-based endpoint: if the browser sends Origin, it must be allow-listed. */
function requireAllowedOrigin(allowedOrigins) {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(authError(AuthErrorCode.ORIGIN_NOT_ALLOWED, 403));
    }
    next();
  };
}

/** Authentication responses are never cached. */
function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
}

/**
 * Factory function that creates and configures the Express router for authentication endpoints.
 * Injects the users repository into the controller to maintain dependency inversion.
 * Sets up request payload validation using Joi before passing the request to the controller.
 *
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {import('express').Router} The configured Express router.
 */
export default function authRouterFactory({
  authService,
  externalAuthService,
  activationService,
  config,
  securityLogger,
}) {
  const router = Router();
  const controller = createAuthController({ authService, activationService, config });
  const { rateLimit } = config;

  const loginLimiter = rateLimit.enabled
    ? createRateLimiter({
        name: 'login',
        windowMs: rateLimit.authWindowMs,
        limit: rateLimit.authMax,
        securityLogger,
        countOnlyFailures: true,
        resetOnSuccess: true,
      })
    : passThrough;
  const forgotLimiter = rateLimit.enabled
    ? createRateLimiter({
        name: 'forgot',
        windowMs: rateLimit.forgotWindowMs,
        limit: rateLimit.forgotMax,
        securityLogger,
      })
    : passThrough;
  // AA07: only failed attempts count (unknown, used or expired links), so a user who opens
  // the link and then activates is never blocked.
  const activationLimiter = rateLimit.enabled
    ? createRateLimiter({
        name: 'activation',
        windowMs: rateLimit.authWindowMs,
        limit: rateLimit.authMax,
        securityLogger,
        countOnlyFailures: true,
      })
    : passThrough;

  router.get('/me', noStore, requireAuthenticated, controller.me);
  router.get('/guest-permissions', controller.guestPermissions);

  // Only /login and /password/change use the login limiter (see the routes below); applying it
  // here as well would count every /auth request (refresh included) twice.
  router.use(noStore);
  if (externalAuthService)
    router.use('/external', externalAuthRouterFactory({ externalAuthService, config }));

  router.post('/login', loginLimiter, validateBody(schemas.login), controller.login);
  router.post('/refresh', requireAllowedOrigin(config.corsOrigins), controller.refresh);
  router.post(
    '/logout',
    requireAllowedOrigin(config.corsOrigins),
    requireAuthenticated,
    controller.logout,
  );
  router.post('/logout-all', requireAuthenticated, controller.logoutAll);
  router.post(
    '/password/forgot',
    forgotLimiter,
    validateBody(schemas.forgot),
    controller.forgotPassword,
  );
  router.post('/password/reset', validateBody(schemas.reset), controller.resetPassword);
  router.post(
    '/password/change',
    loginLimiter, // Limita tentativas de login em massa com token válido
    requireAuthenticated,
    validateBody(schemas.change),
    controller.changePassword,
  );

  // AA07: public on purpose (the account is not active yet, so there is no session to require).
  router.post(
    '/activation/inspect',
    activationLimiter,
    validateBody(schemas.activationInspect),
    controller.inspectActivation,
  );
  router.post(
    '/activation/local',
    activationLimiter,
    validateBody(schemas.activationLocal),
    controller.activateLocal,
  );

  return router;
}
