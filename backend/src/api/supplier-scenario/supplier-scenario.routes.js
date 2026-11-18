import Joi from 'joi';
import * as controller from './supplier-scenario.controller.js';

import { Router } from 'express';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { createDefaultAiDataRepository } from '../ai-data/ai-data.routes.js';

/**
 * @param {object} [scenarioRepository]
 * @param {object} [catalogueReader] read-only catalogue (ai-data repository) used to check product references
 */
export default function supplierScenarioRouterFactory(
  scenarioRepository,
  catalogueReader = createDefaultAiDataRepository(),
) {
  const router = Router();

  const canRead = requirePermission(Permission.SUPPLIERS_READ);
  const canWrite = requirePermission(Permission.SUPPLIERS_IMPORT);

  const supplierSchema = Joi.object({
    id: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Supplier id is mandatory',
    }),
    // Optional: the supplier id is used as name when it is missing.
    name: Joi.string().trim().allow('').optional(),
  });

  const supplierOfferSchema = Joi.object({
    supplierId: Joi.string().trim().required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Supplier id is mandatory',
    }),
    priceEur: Joi.number().min(0).required().messages({
      'any.required': 'Mandatory field',
      'number.base': 'Price must be a number',
      'number.min': 'Price cannot be negative',
    }),
    stockUnits: Joi.number().integer().min(1).required().messages({
      'any.required': 'Mandatory field',
      'number.base': 'Stock units must be a number',
      'number.integer': 'Stock units must be an integer',
      'number.min': 'Stock units must be at least 1',
    }),
    leadTimeDays: Joi.number().min(0).required().messages({
      'any.required': 'Mandatory field',
      'number.base': 'Lead time must be a number',
      'number.min': 'Lead time cannot be negative',
    }),
    supplyLimit: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Supply limit must be a number',
      'number.integer': 'Supply limit must be an integer',
      'number.min': 'Supply limit cannot be negative',
    }),
  });

  const productOffersSchema = Joi.object({
    productId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Mandatory field',
      'string.hex': 'Invalid ID format',
      'string.length': 'Invalid ID format',
    }),
    offers: Joi.array().items(supplierOfferSchema).required().messages({
      'any.required': 'Mandatory field',
    }),
  });

  const supplierScenarioSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'any.required': 'Mandatory field',
      'string.empty': 'Scenario name is mandatory',
    }),
    // `version` and `simulated` are still validated when sent (old contract) but ignored:
    // the back end assigns the next version and always stores the offers as simulated.
    version: Joi.number().integer().min(1).optional(),
    simulated: Joi.boolean().optional(),
    suppliers: Joi.array().items(supplierSchema).required().messages({
      'any.required': 'Mandatory field',
    }),
    products: Joi.array().items(productOffersSchema).required().messages({
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

  router.get('/', canRead, validate(searchSchema, 'query'), (req, res, next) =>
    controller.list(req, res, next, scenarioRepository),
  );

  router.post('/', canWrite, validate(supplierScenarioSchema), (req, res, next) =>
    controller.create(req, res, next, scenarioRepository, catalogueReader),
  );

  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, scenarioRepository),
  );

  router.put('/:id', canWrite, validateId, validate(deactivateSchema), (req, res, next) =>
    controller.update(req, res, next, scenarioRepository),
  );

  return router;
}
