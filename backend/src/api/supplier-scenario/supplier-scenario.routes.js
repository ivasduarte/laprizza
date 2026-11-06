import Joi from 'joi';
import * as controller from './supplier-scenario.controller.js';
import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';

export default function supplierScenarioRouterFactory(scenarioRepository) {
  const router = Router();
  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const supplierSchema = Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().optional()
  });

  const supplierOfferSchema = Joi.object({
    supplierId: Joi.string().trim().required(),
    priceEur: Joi.number().min(0).required(),
    stockUnits: Joi.number().integer().min(1).required(),
    leadTimeDays: Joi.number().min(0).required(),
    supplyLimit: Joi.number().integer().min(0).optional()
  });

  const productOffersSchema = Joi.object({
    productId: Joi.string().hex().length(24).required(),
    offers: Joi.array().items(supplierOfferSchema).required()
  });

  const supplierScenarioSchema = Joi.object({
    name: Joi.string().trim().min(1).required(),
    version: Joi.number().integer().min(1).optional(),
    simulated: Joi.boolean().optional(),
    suppliers: Joi.array().items(supplierSchema).required(),
    products: Joi.array().items(productOffersSchema).required()
  });

  const deactivateSchema = Joi.object({
    isActive: Joi.boolean().valid(false).required()
  });

  const searchSchema = Joi.object({ name: Joi.string().trim().min(1).optional() });
  const objectIdSchema = Joi.string().hex().length(24).required();

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const validate = (schema, source = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) return next(new AppError('Validation failed', 400, error.details.map((d) => d.message)));
    if (source === 'body') req.body = value;
    next();
  };

  router.get('/', verifyToken, requireRole(readRoles), validate(searchSchema, 'query'), (req, res, next) => controller.list(req, res, next, scenarioRepository));
  router.post('/', verifyToken, requireRole([Roles.MANAGER]), validate(supplierScenarioSchema), (req, res, next) => controller.create(req, res, next, scenarioRepository));
  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) => controller.getById(req, res, next, scenarioRepository));
  router.put('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, validate(deactivateSchema), (req, res, next) => controller.update(req, res, next, scenarioRepository));

  return router;
}
