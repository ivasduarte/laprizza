import express, { Router } from 'express';
import { createExternalAuthController } from './external-auth.controller.js';
import { createTransactionCodec } from '../../infrastructure/oidc/oidc-transaction.js';
import { AppError } from '../../application/app-error.js';
import { ExternalAuthCode } from '../../application/auth/external-auth.service.js';

/** Provider names are looked up in the configuration; this only rejects malformed input early. */
function validateProvider(req, _res, next) {
  if (!/^[a-z]{2,20}$/.test(req.params.provider)) {
    return next(new AppError('Unknown authentication provider.', 404, null, ExternalAuthCode.PROVIDER_NOT_FOUND));
  }
  next();
}

/**
 * Router mounted at /auth/external (inside the auth router: it inherits no-store and rate limiting).
 *
 * @param {{externalAuthService: object, config: object}} deps
 */
export default function externalAuthRouterFactory({ externalAuthService, config }) {
  const router = Router();
  const controller = createExternalAuthController({
    externalAuthService,
    config,
    transactionCodec: createTransactionCodec({
      secret: config.jwtSecret,
      ttlMs: config.external.transactionTtlMs,
    }),
  });

  router.get('/providers', controller.providers);
  router.get('/:provider/login', validateProvider, controller.login);
  router.get('/:provider/callback', validateProvider, controller.callback);
  // AA07: form POST from the activation page (urlencoded body with the invitation token).
  router.post(
    '/activate',
    express.urlencoded({ extended: false, limit: '1kb' }),
    controller.activate,
  );
  return router;
}
