import Joi from 'joi';
import * as controller from './users.controller.js';

import { Router } from 'express';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
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
    roles: Joi.array()
      .items(
        Joi.string()
          .valid(...Object.values(Roles))
          .messages({
            'any.only': `Invalid role. Must be one of: ${Object.values(Roles).join(', ')}.`,
          }),
      )
      .unique()
      .default([])
      .messages({ 'array.unique': 'Duplicate roles are not allowed.' }),
    customerId: Joi.string().hex().length(24).optional().messages({
      'string.hex': 'Invalid customerId format.',
    }),
  })
    .or('username', 'email')
    .messages({
      'object.missing': 'You must provide either a username or an email.',
    });

  // List user (Manager only)
  router.get('/', requirePermission(Permission.USERS_READ), (req, res, next) =>
    controller.list(req, res, next, usersRepository),
  );

  // Create a new user (Manager only)
  router.post(
    '/',
    requirePermission(Permission.USERS_CREATE),
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
    password: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'You must provide at least one field to update (password or isActive).',
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

  const roleParamSchema = Joi.string()
    .valid(...Object.values(Roles))
    .required();

  const validateRoleParam = (req, _res, next) => {
    const { error } = roleParamSchema.validate(req.params.role);
    if (error) return next(new AppError('Invalid role.', 400));
    next();
  };

  // Check by ID (Manager only)
  router.get('/:id', requirePermission(Permission.USERS_READ), validateId, (req, res, next) =>
    controller.getById(req, res, next, usersRepository),
  );

  // Change role, password, or disable (Manager only)
  router.patch(
    '/:id',
    requirePermission(Permission.USERS_MANAGE),
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

  router.put(
    '/:id/roles/:role',
    requirePermission(Permission.USERS_READ),
    validateId,
    validateRoleParam,
    (req, res, next) => controller.addRole(req, res, next, usersRepository),
  );

  router.delete(
    '/:id/roles/:role',
    requirePermission(Permission.USERS_READ),
    validateId,
    validateRoleParam,
    (req, res, next) => controller.removeRole(req, res, next, usersRepository),
  );

  return router;
}
