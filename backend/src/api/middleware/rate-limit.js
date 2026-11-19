import { rateLimit } from 'express-rate-limit';
import { AuthErrorCode, tooManyAttempts } from '../../application/auth/auth-errors.js';

/**
 * Per-IP limit. In-memory store (one instance); with several instances, use a shared store.
 * The IP comes from req.ip, which respects app.set('trust proxy').
 */
export function createRateLimiter({ name, windowMs, limit, securityLogger, skip, countOnlyFailures = false, resetOnSuccess = false }) {
  const limiter = rateLimit({
    windowMs,
    limit,
    skip,
    skipSuccessfulRequests: countOnlyFailures,
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
  if (!resetOnSuccess) return limiter;

  return function limiterWithReset(req, res, next) {
    return limiter(req, res, (err) => {
      const key = req.rateLimit?.key;
      if (!err && key) {
        res.once('finish', () => {
          if (res.statusCode < 400) limiter.resetKey(key)?.catch?.(() => {});
        });
      }
      next(err);
    });
  };
}

/** Middleware that does nothing (limits disabled, e.g. NODE_ENV=test). */
export const passThrough = (_req, _res, next) => next();