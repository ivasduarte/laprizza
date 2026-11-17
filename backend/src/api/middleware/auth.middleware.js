import { AuthErrorCode, authError } from '../../application/auth/auth-errors.js';
import { requestContext } from './request-context.js';

/**
 * Creates the authentication middleware: validates the Bearer token AND the server-side state
 * on every request (user active, tokenVersion, sid session not revoked/expired). Populates req.user.
 * Used through app.locals.authenticate by requirePermission/requireAuthenticated (authorization.middleware.js); not mounted on routes directly.
 *
 * @param {{authService: object, securityLogger: object}} deps
 * @returns {import('express').RequestHandler}
 */
export function createAuthenticate({ authService, securityLogger }) {
  return async function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      securityLogger.log('ACCESS_DENIED', {
        ...requestContext(req),
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
          ...requestContext(req),
          reason: err.code,
        });
      }
      next(err);
    }
  };
}
