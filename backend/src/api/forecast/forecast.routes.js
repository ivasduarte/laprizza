import Joi from 'joi';
import * as controller from './forecast.controller.js';
import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';

export default function forecastRouterFactory(forecastRepository) {
  const router = Router();
  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];

  const forecastEntrySchema = Joi.object({
    date: Joi.string().trim().required(),
    productId: Joi.string().hex().length(24).required(),
    sizeId: Joi.string().hex().length(24).allow(null).optional(),
    quantity: Joi.number().integer().min(0).required()
  });

  const forecastSchema = Joi.object({
    name: Joi.string().trim().min(1).required(),
    version: Joi.number().integer().min(1).optional(),
    startDate: Joi.string().trim().required(),
    endDate: Joi.string().trim().required(),
    entries: Joi.array().items(forecastEntrySchema).required()
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

  router.get('/', verifyToken, requireRole(readRoles), validate(searchSchema, 'query'), (req, res, next) => controller.list(req, res, next, forecastRepository));
  router.post('/', verifyToken, requireRole([Roles.MANAGER]), validate(forecastSchema), (req, res, next) => controller.create(req, res, next, forecastRepository));
  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) => controller.getById(req, res, next, forecastRepository));
  router.put('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, validate(deactivateSchema), (req, res, next) => controller.update(req, res, next, forecastRepository));

  return router;
}
