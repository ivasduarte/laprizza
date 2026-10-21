import * as authService from '../../application/auth/auth.service.js';

/**
 * Handles the user login request.
 * Authenticates the user using the provided credentials and returns a JSON Web Token (JWT) upon success.
 * Any caught errors are forwarded to the global error-handling middleware.
 *
 * @param {import('express').Request} req - The Express request object, containing the login credentials in `req.body`.
 * @param {import('express').Response} res - The Express response object, used to send the HTTP response.
 * @param {import('express').NextFunction} next - The Express next middleware function, used for error propagation.
 * @param {Object} [usersRepository] - An optional injected users repository for database operations (useful for testing or dependency injection).
 * @returns {Promise<void>}
 */
export const login = async (req, res, next, usersRepository) => {
  try {
    const token = await authService.login(req.body, usersRepository);
    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
};
