import Joi from 'joi';
import * as controller from './users.controller.js';

import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

/**
 * Factory function that creates and configures the Express router for user management endpoints.
 * Injects the users repository into the controllers.
 * Enforces authentication, role-based access control (Manager only), and payload validation using Joi.
 *
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {import('express').Router} The configured Express router.
 */
export default function usersRouterFactory(usersRepository) {
  const router = Router();

  const createUserSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).trim().optional(),
    email: Joi.string().trim().lowercase().email().max(254).required().messages({
      'any.required': 'Mandatory field',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Mandatory field.',
    }),
    role: Joi.string()
      .valid(...Object.values(Roles))
      .required()
      .messages({
        'any.only': 'Invalid role. Must be Manager, Employee, or Customer',
        'any.required': 'Mandatory field.',
      }),
    customerId: Joi.string().hex().length(24).optional().messages({
      'string.hex': 'Invalid customerId format.',
    }),
  })
    .or('username', 'email')
    .messages({
      'object.missing': 'You must provide either a username or an email.',
    });

  // List user (Manager only)
  router.get('/', verifyToken, requireRole([Roles.MANAGER]), (req, res, next) =>
    controller.list(req, res, next, usersRepository),
  );

  // Create a new user (Manager only)
  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error, value } = createUserSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          return next(new AppError('Validation failed', 400, joiDetails(error)));
        }

        req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.create(req, res, next, usersRepository),
  );

  const updateUserSchema = Joi.object({
    role: Joi.string()
      .valid(...Object.values(Roles))
      .optional(),
    password: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'You must provide at least one field to update (role, password, or isActive).',
    });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  /**
   * Express middleware to validate MongoDB ObjectId format in route parameters.
   * Prevents CastErrors from the database layer by stopping malformed IDs early.
   *
   * @param {import('express').Request} req - The Express request object.
   * @param {import('express').Response} res - The Express response object.
   * @param {import('express').NextFunction} next - The Express next middleware function.
   */
  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  // Check by ID (Manager only)
  router.get('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, (req, res, next) =>
    controller.getById(req, res, next, usersRepository),
  );

  // Change role, password, or disable (Manager only)
  router.patch(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateUserSchema.validate(req.body, { stripUnknown: true });
        if (error) {
          return next(new AppError('Validation failed', 400, joiDetails(error)));
        }
        req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.update(req, res, next, usersRepository),
  );

  return router;
}
