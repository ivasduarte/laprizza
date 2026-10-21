import Joi from 'joi';
import * as controller from './allergen.controller.js';

import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';

export default function allergenRouterFactory(allergenRepository) {
  const router = Router();

  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const allergenSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Allergen name is mandatory',
    }),
  });

  const deactivateSchema = Joi.object({
    isActive: Joi.boolean().valid(false).required().messages({
      'any.required': 'isActive is required',
      'any.only': 'Only deactivation is supported: isActive must be false',
      'boolean.base': 'isActive must be a boolean',
    }),
  });

  const searchSchema = Joi.object({
    name: Joi.string().trim().min(1).optional(),
  });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  const nameParamSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'any.required': 'Name parameter is required',
      'string.empty': 'Name parameter cannot be empty',
    }),
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const validate =
    (schema, source = 'body') =>
    (req, res, next) => {
      try {
        const { error, value } = schema.validate(req[source], {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error) {
          return next(
            new AppError(
              'Validation failed',
              400,
              error.details.map((d) => d.message),
            ),
          );
        }
        if (source === 'body') req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    };

  router.get(
    '/',
    verifyToken,
    requireRole(readRoles),
    validate(searchSchema, 'query'),
    (req, res, next) => controller.list(req, res, next, allergenRepository),
  );

  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validate(allergenSchema),
    (req, res, next) => controller.create(req, res, next, allergenRepository),
  );

  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, allergenRepository),
  );

  router.get(
    '/name/:name',
    verifyToken,
    requireRole(readRoles),
    validate(nameParamSchema, 'params'),
    (req, res, next) => controller.getByName(req, res, next, allergenRepository),
  );

  router.put(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    validate(deactivateSchema),
    (req, res, next) => controller.update(req, res, next, allergenRepository),
  );

  return router;
}
