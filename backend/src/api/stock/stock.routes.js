import { Router } from 'express';
import * as controller from './stock.controller.js';
import Joi from 'joi';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';

export default function stockRouterFactory(repos) {
  const router = Router();
  
  const canRead = requirePermission(Permission.STOCK_READ);
  const canWrite = requirePermission(Permission.STOCK_WRITE);

  const canReadInactive = requirePermission(Permission.STOCK_READ_INACTIVE);
  const inactiveNeedsPermission = (req, res, next) =>
    req.validatedQuery?.includeInactive ? canReadInactive(req, res, next) : next();

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
    includeInactive: Joi.boolean().default(false),
  });

  const validateListQuery = (req, res, next) => {
    const { error, value } = listStockQuerySchema.validate(
      { ...req.query },
      { allowUnknown: true, stripUnknown: true },
    );
    if (error) {
      return next(new AppError('Validation failed.', 400, joiDetails(error)));
    }
    req.validatedQuery = value;
    next();
  };

  router.get('/', canRead, validateListQuery, inactiveNeedsPermission, (req, res, next) =>
    controller.list(req, res, next, repos),
  );
  router.get('/:productId', canRead, validateId, (req, res, next) =>
    controller.getByProductId(req, res, next, repos),
  );
  router.patch(
    '/:productId',
    canWrite,
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = adjustStockSchema.validate(req.body, { stripUnknown: true });
        if (error) return next(new AppError('Validation failed.', 400, joiDetails(error)));
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
