import { Router } from 'express';
import * as controller from './stock.controller.js';
import Joi from 'joi';
import { Roles } from '../domain/users.domain.js';
import { AppError } from '../application/AppError.js';
import { requireRole, verifyToken } from './middleware/auth.middleware.js';

export default function stockRouterFactory(repos) {
  const router = Router();
  const allowedRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const objectIdSchema = Joi.string().hex().length(24).message({
    'string.hex': 'Invalid ID format.',
    'string.length': 'Invalid ID format.',
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.productId);
    if (error) return next(new AppError('Invalid Product ID format.', 400));
    next();
  };

  const adjustStockSchema = Joi.object({
    amount: Joi.number().integer().positive().required().messages({
      'number.base': 'Amount must be a number.',
      'number.integer': 'Amount must be an integer.',
      'number.positive': 'Amount must be a positive integer.',
      'any.required': 'Amount is required.',
    }),
    operation: Joi.string().valid('increase', 'decrease').required().messages({
      'any.only': 'Operation must be either increase or decrease.',
      'any.required': 'Operation is required.',
    }),
  });

  const listStockQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').optional(),
  });

  const validateListQuery = (req, res, next) => {
    const { error, value } = listStockQuerySchema.validate(
      { ...req.query },
      { allowUnknown: true, stripUnkown: true },
    );
    if (error) {
      return next(
        new AppError(
          'Validation failed.',
          400,
          error.details.map((d) => d.message),
        ),
      );
    }
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };

  router.get('/', verifyToken, requireRole(allowedRoles), validateListQuery, (req, res, next) =>
    controller.list(req, res, next, repos),
  );
  router.get('/:productId', verifyToken, requireRole(allowedRoles), validateId, (req, res, next) =>
    controller.getByProductId(req, res, next, repos),
  );
  router.patch(
    '/:productId',
    verifyToken,
    requireRole(allowedRoles),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = adjustStockSchema.validate(req.body, { stripUnknown: true });
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
    (req, res, next) => controller.adjustStock(req, res, next, repos),
  );

  return router;
}
