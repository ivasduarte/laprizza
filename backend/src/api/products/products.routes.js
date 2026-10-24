import { Router } from 'express';
import * as controller from './products.controller.js';
import Joi from 'joi';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';

export default function productsRouterFactory(repos) {
  const router = Router();
  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const objectIdSchema = Joi.string().hex().length(24).messages({
    'string.hex': 'Invalid ID format.',
    'string.length': 'Invalid ID format.',
  });

  const createProductSchema = Joi.object({
    name: Joi.string().min(1).max(100).trim().required().messages({
      'any.required': 'Mandatory field.',
    }),
    description: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field.',
    }),
    price: Joi.number().min(0).optional().messages({
      'number.min': 'Price must be a non-negative number.',
    }),
    sellable: Joi.boolean().required().messages({
      'any.required': 'Mandatory field.',
    }),
    stockControlled: Joi.boolean().required().messages({
      'any.required': 'Mandatory field.',
    }),
    categoryId: objectIdSchema.required().messages({
      'any.required': 'Mandatory field.',
    }),
    pizzaComponentTypeId: objectIdSchema.optional().allow(null).messages({
      'string.hex': 'Invalid ID format.',
      'string.length': 'Invalid ID format.',
    }),
    allergenIds: Joi.array().items(objectIdSchema).unique().optional().messages({
      'array.unique': 'Duplicate allergen IDs are not allowed.',
    }),
  });

  const listProductsQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').optional().messages({
      'string.max': 'Search term must be at most 100 characters long.',
    }),
    categoryId: objectIdSchema.optional().messages({
      'string.hex': 'Invalid ID format.',
      'string.length': 'Invalid ID format.',
    }),
    sellable: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
  });

  const validateListQuery = (req, res, next) => {
    const { error, value } = listProductsQuerySchema.validate(
      { ...req.query },
      { allowUnknown: true, stripUnknown: true },
    );
    if (error)
      return next(
        new AppError(
          'Validation failed.',
          400,
          error.details.map((d) => d.message),
        ),
      );
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format.', 400));
    next();
  };

  router.get('/', verifyToken, requireRole(readRoles), validateListQuery, (req, res, next) =>
    controller.list(req, res, next, repos),
  );
  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error, value } = createProductSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error)
          return next(
            new AppError(
              'Validation failed.',
              400,
              error.details.map((d) => d.message),
            ),
          );
        req.body = value;
        next();
      } catch (error) {
        next(error);
      }
    },
    (req, res, next) => controller.create(req, res, next, repos),
  );

  const updateProductSchema = Joi.object({
    name: Joi.string().min(1).max(100).trim().optional().messages({
      'string.min': 'Name must be at least 1 character long.',
      'string.max': 'Name must be at most 100 characters long.',
    }),
    description: Joi.string().trim().optional(),
    price: Joi.number().min(0).optional().messages({
      'number.min': 'Price must be a non-negative number.',
    }),
    sellable: Joi.boolean().optional(),
    stockControlled: Joi.boolean().optional(),
    categoryId: objectIdSchema.optional(),
    pizzaComponentTypeId: objectIdSchema.optional().allow(null).messages({
      'string.hex': 'Invalid ID format.',
      'string.length': 'Invalid ID format.',
    }),
    allergenIds: Joi.array().items(objectIdSchema).unique().optional().messages({
      'array.unique': 'Duplicate allergen IDs are not allowed.',
    }),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided for update.',
    });

  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) => {
    controller.getById(req, res, next, repos);
  });

  router.patch(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateProductSchema.validate(req.body, { stripUnknown: true });
        if (error)
          return next(
            new AppError(
              'Validation failed.',
              400,
              error.details.map((d) => d.message),
            ),
          );
        req.body = value;
        next();
      } catch (error) {
        next(error);
      }
    },
    (req, res, next) => controller.update(req, res, next, repos),
  );

  return router;
}
