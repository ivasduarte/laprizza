/**
 * Custom error class for application-specific exceptions.
 * Extends the built-in Error object to include HTTP status codes,
 * optional error details, and an expose flag used by the global error handler.
 *
 * @extends Error
 */
export class AppError extends Error {
  /**
   * Creates a new AppError instance.
   *
   * @param {string} message - The error message to be returned to the client.
   * @param {number} status - The HTTP status code associated with the error (e.g., 400, 401, 403, 404).
   * @param {any} [details=null] - Optional additional error details (e.g., an array of Joi validation messages).
   */
  constructor(message, status, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}