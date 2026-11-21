import { Router } from 'express';
import * as controller from './stock.controller.js';
import Joi from 'joi';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { MAX_STOCK_QUANTITY } from '../../domain/stock/stock.domain.js';

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

  // WEB04: `set` records a physical count (amount = counted quantity, 0 allowed); increase and
  // decrease move `amount` units (> 0). The domain checks the result (0..MAX_STOCK_QUANTITY).
  const adjustStockSchema = Joi.object({
    operation: Joi.string().valid('increase', 'decrease', 'set').required().messages({
      'any.only': 'Operation must be increase, decrease or set.',
      'any.required': 'Operation is required.',
    }),
    amount: Joi.number()
      .integer()
      .max(MAX_STOCK_QUANTITY)
      .when('operation', { is: 'set', then: Joi.number().min(0), otherwise: Joi.number().positive() })
      .required()
      .messages({
        'number.base': 'Amount must be a number.',
        'number.integer': 'Amount must be an integer.',
        'number.positive': 'Amount must be a positive integer.',
        'number.min': 'The counted quantity cannot be negative.',
        'number.max': `Amount cannot exceed ${MAX_STOCK_QUANTITY}.`,
        'any.required': 'Amount is required.',
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
