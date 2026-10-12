import jwt from 'jsonwebtoken';
import { AppError } from '../../application/AppError.js';

/**
 * Express middleware to verify the JSON Web Token (JWT) provided in the Authorization header.
 * Expects the header format: "Bearer <token>".
 * If valid, decodes the token and attaches the payload to the request object (`req.user`).
 * If missing, invalid, or expired, triggers a 401 Unauthorized AppError.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @returns {void}
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided or invalid format.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return next(new AppError('Invalid or expired token.', 401));
  }
}

/**
 * Express middleware factory to enforce role-based access control.
 * Checks if the authenticated user's role is included in the provided allowed roles array.
 * This middleware must be used after `verifyToken`, as it relies on `req.user` being populated.
 *
 * @param {string[]} allowedRoles - An array of roles permitted to access the route (e.g., ['MANAGER', 'EMPLOYEE']).
 * @returns {import('express').RequestHandler} The Express middleware function that enforces the role check.
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}