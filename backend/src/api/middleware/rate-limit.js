import { rateLimit } from 'express-rate-limit';
import { AuthErrorCode, tooManyAttempts } from '../../application/auth/auth-errors.js';

/**
 * Per-IP limit. In-memory store (one instance); with several instances, use a shared store.
 * The IP comes from req.ip, which respects app.set('trust proxy').
 */
export function createRateLimiter({ name, windowMs, limit, securityLogger }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, _res, next) => {
      securityLogger.log('RATE_LIMITED', {
        ip: req.ip,
        path: `${req.baseUrl}${req.path}`,
        limiter: name,
      });
      const resetTime = req.rateLimit?.resetTime;
      const waitMs = resetTime ? resetTime.getTime() - Date.now() : windowMs;
      next(tooManyAttempts(AuthErrorCode.RATE_LIMITED, waitMs));
    },
  });
}

/** Middleware that does nothing (limits disabled, e.g. NODE_ENV=test). */
export const passThrough = (_req, _res, next) => next();