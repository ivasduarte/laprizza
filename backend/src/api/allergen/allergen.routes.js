import Joi from 'joi';
import * as controller from './allergen.controller.js';

import { Router } from 'express';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

export default function allergenRouterFactory(allergenRepository) {
  const router = Router();

  // Allergen management is MANAGER only; other roles see allergens through the catalogue.
  const canRead = requirePermission(Permission.ALLERGENS_READ);
  const canWrite = requirePermission(Permission.ALLERGENS_WRITE);

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
          return next(new AppError('Validation failed', 400, joiDetails(error)));
        }
        if (source === 'body') req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    };

  router.get(
    '/',
    canRead,
    validate(searchSchema, 'query'),
    (req, res, next) => controller.list(req, res, next, allergenRepository),
  );

  router.post(
    '/',
    canWrite,
    validate(allergenSchema),
    (req, res, next) => controller.create(req, res, next, allergenRepository),
  );

  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, allergenRepository),
  );

  router.get(
    '/name/:name',
    canRead,
    validate(nameParamSchema, 'params'),
    (req, res, next) => controller.getByName(req, res, next, allergenRepository),
  );

  router.put(
    '/:id',
    canWrite,
    validateId,
    validate(deactivateSchema),
    (req, res, next) => controller.update(req, res, next, allergenRepository),
  );

  return router;
}
