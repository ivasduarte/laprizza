import Joi from 'joi';
import * as controller from './component-size-configuration.controller.js';

import { Router } from 'express';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';

export default function componentSizeConfigurationRouterFactory(repos) {
  // mergeParams makes the :productId of the parent path available in this router
  const router = Router({ mergeParams: true });

  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const objectIdSchema = Joi.string().hex().length(24).messages({
    'string.base': 'Invalid ID format',
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  const priceSchema = Joi.number().strict().min(0).required().messages({
    'number.base': 'Price must be a number',
    'number.min': 'Price must be a non-negative number',
    'any.required': 'Price is a mandatory field',
  });

  const stockUnitsConsumedSchema = Joi.number()
    .strict()
    .integer()
    .min(1)
    .allow(null)
    .optional()
    .messages({
      'number.base': 'Stock units consumed must be a number',
      'number.integer': 'Stock units consumed must be an integer',
      'number.min': 'Stock units consumed must be greater than or equal to 1',
    });

  const createSchema = Joi.object({
    pizzaSizeId: objectIdSchema.required().messages({ 'any.required': 'Pizza size is required' }),
    price: priceSchema,
    stockUnitsConsumed: stockUnitsConsumedSchema,
  });

  const updateSchema = Joi.object({
    price: priceSchema,
    stockUnitsConsumed: stockUnitsConsumedSchema,
  });

  const validateIds = (req, res, next) => {
    for (const param of ['productId', 'sizeId']) {
      if (req.params[param] === undefined) continue;
      const { error } = objectIdSchema.validate(req.params[param]);
      if (error) return next(new AppError('Invalid ID format', 400));
    }
    next();
  };

  const validateBody = (schema) => (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

      if (error) {
        return next(new AppError('Validation failed', 400, joiDetails(error)));
      }

      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };

  router.get('/', verifyToken, requireRole(readRoles), validateIds, (req, res, next) =>
    controller.list(req, res, next, repos),
  );

  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateIds,
    validateBody(createSchema),
    (req, res, next) => controller.create(req, res, next, repos),
  );

  router.get('/:sizeId', verifyToken, requireRole(readRoles), validateIds, (req, res, next) =>
    controller.getBySize(req, res, next, repos),
  );

  router.put(
    '/:sizeId',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateIds,
    validateBody(updateSchema),
    (req, res, next) => controller.update(req, res, next, repos),
  );

  router.delete(
    '/:sizeId',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateIds,
    (req, res, next) => controller.remove(req, res, next, repos),
  );

  return router;
}
