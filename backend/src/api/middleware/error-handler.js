import { STATUS_CODES } from 'node:http';

/**
 * Global Express error-handling middleware.
 * Intercepts errors thrown in routes or other middleware and formats them into a standardized JSON response.
 * Hides internal error messages for server errors (500+) unless explicitly exposed, logging them to the console instead.
 *
 * @param {Error & { status?: number, expose?: boolean, details?: any }} err - The error object caught by Express. Can include custom HTTP `status`, an `expose` flag for messages, and additional `details`.
 * @param {import('express').Request} _req - The Express request object (unused).
 * @param {import('express').Response} res - The Express response object used to send the JSON error payload.
 * @param {import('express').NextFunction} _next - The Express next middleware function (unused).
 * @returns {void}
 */
export function errorHandler(err, _req, res, _next) {
  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);

  const code = STATUS_CODES[status]?.toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'ERROR';
  const message = status < 500 && err.expose ? err.message : STATUS_CODES[status];

  const response = { error: { status, code, message } };
  if (err.details) response.error.details = err.details;

  res.status(status).json(response);
}