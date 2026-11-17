import Joi from 'joi';
import * as controller from './pizza-component-type.controller.js';

import { Router } from 'express';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';

export default function pizzaComponentTypesRouterFactory(
  pizzaComponentTypesRepository,
  productsRepository,
) {
  const router = Router();

  const canRead = requirePermission(Permission.PRODUCTS_READ);
  const canWrite = requirePermission(Permission.PIZZAS_WRITE);

  const nameSchema = Joi.string().trim().required().messages({
    'string.base': 'Name must be a text.',
    'string.empty': 'Name is required.',
    'any.required': 'Mandatory field.',
  });

  const integerSchema = (label) =>
    Joi.number()
      .integer()
      .strict()
      .messages({
        'number.base': `${label} must be a number.`,
        'number.integer': `${label} must be an integer.`,
      });

  const pizzaComponentTypeSchema = Joi.object({
    name: nameSchema,
    assemblyOrder: integerSchema('Assembly Order')
      .required()
      .messages({ 'any.required': 'Assembly order is required.' }),
    minQuantity: integerSchema('Minimum Quantity').required().messages({
      'any.required': 'Minimum quantity is required.',
    }),
    maxQuantity: integerSchema('Maximum Quantity').allow(null).optional(),
  });

  const searchPizzaComponentTypeSchema = Joi.object({
    name: Joi.string().trim().allow('').optional().messages({
      'string.base': 'Name must be a text.',
    }),
  });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format.',
    'string.length': 'Invalid ID format.',
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const validateBody = (req, res, next) => {
    try {
      const { error, value } = pizzaComponentTypeSchema.validate(req.body, {
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
  };

  router.get(
    '/',
    canRead,
    async (req, res, next) => {
      try {
        const { error } = searchPizzaComponentTypeSchema.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          return next(new AppError('Validation failed', 400, joiDetails(error)));
        }

        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.list(req, res, next, pizzaComponentTypesRepository),
  );

  router.post('/', canWrite, validateBody, (req, res, next) =>
    controller.create(req, res, next, pizzaComponentTypesRepository),
  );

  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, pizzaComponentTypesRepository),
  );

  router.put(
    '/:id',
    canWrite,
    validateId,
    validateBody,
    (req, res, next) => controller.update(req, res, next, pizzaComponentTypesRepository),
  );

  router.delete('/:id', canWrite, validateId, (req, res, next) =>
    controller.remove(req, res, next, pizzaComponentTypesRepository, productsRepository),
  );

  return router;
}
