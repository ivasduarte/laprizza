import Joi from 'joi';
import * as controller from './forecast.controller.js';

import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

export default function forecastRouterFactory(forecastRepository) {
  const router = Router();

  const readRoles = [Roles.MANAGER];

  const forecastEntrySchema = Joi.object({
    date: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Entry date is mandatory',
    }),
    productId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Mandatory field',
      'string.hex': 'Invalid ID format',
      'string.length': 'Invalid ID format',
    }),
    sizeId: Joi.string().hex().length(24).allow(null).optional().messages({
      'string.hex': 'Invalid ID format',
      'string.length': 'Invalid ID format',
    }),
    quantity: Joi.number().integer().min(0).required().messages({
      'any.required': 'Mandatory field',
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
    }),
  });

  const forecastSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Forecast name is mandatory',
    }),
    version: Joi.number().integer().min(1).optional(),
    startDate: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Start date is mandatory',
    }),
    endDate: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'End date is mandatory',
    }),
    entries: Joi.array().items(forecastEntrySchema).required().messages({
      'any.required': 'Mandatory field',
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
    verifyToken,
    requireRole(readRoles),
    validate(searchSchema, 'query'),
    (req, res, next) => controller.list(req, res, next, forecastRepository),
  );

  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validate(forecastSchema),
    (req, res, next) => controller.create(req, res, next, forecastRepository),
  );

  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, forecastRepository),
  );

  router.put(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    validate(deactivateSchema),
    (req, res, next) => controller.update(req, res, next, forecastRepository),
  );

  return router;
}
