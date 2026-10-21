import * as usersService from '../../application/users/users.service.js';
import * as authService from '../../application/auth/auth.service.js';
import { AppError } from '../../application/app-error.js';

/**
 * Handles the request to retrieve a list of all users.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {Promise<void>}
 */
export const list = async (req, res, next, usersRepository) => {
  try {
    const users = await usersService.listUsers(usersRepository);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to create a new user.
 *
 * @param {import('express').Request} req - The Express request object, containing user details in `req.body`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {Promise<void>}
 */
export const create = async (req, res, next, usersRepository) => {
  try {
    const newUser = await authService.registerUser(req.body, usersRepository);
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to retrieve a specific user by their ID.
 *
 * @param {import('express').Request} req - The Express request object, containing the user ID in `req.params.id`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {Promise<void>}
 */
export const getById = async (req, res, next, usersRepository) => {
  try {
    const user = await usersService.getUserById(req.params.id, usersRepository);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to update an existing user.
 * Enforces self-protection logic: prevents a Manager from modifying their own role or active status.
 *
 * @param {import('express').Request} req - The Express request object, containing the user ID in `req.params.id`, update data in `req.body`, and the authenticated user details in `req.user`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {Promise<void>}
 */
export const update = async (req, res, next, usersRepository) => {
  try {
    // Prevents a Manager from altering their own role or isActive status.
    if (req.user.userId === req.params.id.toLowerCase()) {
      if (req.body.role || req.body.isActive !== undefined) {
        throw new AppError('Managers cannot change their own role or active status.', 403);
      }
    }
    const updatedUser = await usersService.updateUser(req.params.id, req.body, usersRepository);
    res.status(200).json(updatedUser);
  } catch (err) {
    next(err);
  }
};
