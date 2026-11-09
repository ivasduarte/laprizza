import { STATUS_CODES } from 'node:http';

const MONGOOSE_CLIENT_ERRORS = new Set(['ValidationError', 'CastError']);

function toValidationDetails(err) {
  const errors = err.name === 'ValidationError' ? Object.values(err.errors ?? {}) : [err];
  return errors.map((e) => `Invalid value for '${e.path}'.`);
}

/**
 * Global Express error-handling middleware.
 * Intercepts errors thrown in routes or other middleware and formats them into a standardized JSON response.
 * Hides internal error messages for server errors (500+) unless explicitly exposed, logging them to the console instead.
 * Mongoose validation/cast errors are treated as client errors (400) and only expose the offending field paths.
 *
 * @param {Error & { status?: number, expose?: boolean, details?: any }} err - The error object caught by Express. Can include custom HTTP `status`, an `expose` flag for messages, and additional `details`.
 * @param {import('express').Request} _req - The Express request object (unused).
 * @param {import('express').Response} res - The Express response object used to send the JSON error payload.
 * @param {import('express').NextFunction} _next - The Express next middleware function (unused).
 * @returns {void}
 */
export function errorHandler(err, _req, res, _next) {
  if (MONGOOSE_CLIENT_ERRORS.has(err?.name)) {
    return res.status(400).json({
      error: {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed.',
        details: toValidationDetails(err),
      },
    });
  }

  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);

  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { status: 400, code: 'MALFORMED_JSON', message: 'Malformed JSON body.' } });
  }

  const derivedCode = STATUS_CODES[status]?.toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'ERROR';
  const code = status < 500 && typeof err.code === 'string' ? err.code : derivedCode;
  const message = status < 500 && err.expose ? err.message : STATUS_CODES[status];

  if (Number.isInteger(err.retryAfterSeconds))
    res.set('Retry-After', String(err.retryAfterSeconds));

  const response = { error: { status, code, message } };
  if (err.details) response.error.details = err.details;

  res.status(status).json(response);
}
