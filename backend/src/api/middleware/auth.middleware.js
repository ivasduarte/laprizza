import { AuthErrorCode, authError } from '../../application/auth/auth-errors.js';

/** Request path without the query string (for logs). */
const pathOf = (req) => `${req.baseUrl ?? ''}${req.path ?? ''}`;

/**
 * Creates the authentication middleware: validates the Bearer token AND the server-side state
 * on every request (user active, tokenVersion, sid session not revoked/expired). Populates req.user.
 *
 * @param {{authService: object, securityLogger: object}} deps
 * @returns {import('express').RequestHandler}
 */
export function createAuthenticate({ authService, securityLogger }) {
  return async function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      securityLogger.log('ACCESS_DENIED', {
        ip: req.ip,
        method: req.method,
        path: pathOf(req),
        reason: AuthErrorCode.TOKEN_MISSING,
      });
      return next(authError(AuthErrorCode.TOKEN_MISSING, 401));
    }
    try {
      req.user = await authService.authenticateAccessToken(header.slice('Bearer '.length).trim());
      next();
    } catch (err) {
      if (err.status === 401) {
        securityLogger.log('ACCESS_DENIED', {
          ip: req.ip,
          method: req.method,
          path: pathOf(req),
          reason: err.code,
        });
      }
      next(err);
    }
  };
}

/**
 * Compatibility with the existing routers: delegates to the middleware configured in createApp
 * (app.locals.authenticate).
 */
export function verifyToken(req, res, next) {
  const authenticate = req.app?.locals?.authenticate;
  if (!authenticate) return next(new Error('Authentication middleware is not configured.'));
  return authenticate(req, res, next);
}

/**
 * RBAC with the role loaded from the database (req.user.role), never the one sent by the client.
 *
 * @param {string[]} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function requireRole(allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      req.app?.locals?.securityLogger?.log('ACCESS_DENIED', {
        userId: req.user?.userId,
        ip: req.ip,
        method: req.method,
        path: pathOf(req),
        reason: 'INSUFFICIENT_ROLE',
      });
      return next(authError(AuthErrorCode.FORBIDDEN, 403));
    }
    next();
  };
}
