import Joi from 'joi';
import { Router } from 'express';
import * as controller from './kitchen-configuration.controller.js';
import { AppError } from '../../application/app-error.js';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';

export default function kitchenConfigurationRouterFactory(kitchenRepository) {
  const router = Router();
  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];
  const writeRoles = [Roles.MANAGER];

  const objectIdSchema = Joi.string().hex().length(24).messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const createSchema = Joi.object({
    name: Joi.string().trim().required(),
    content: Joi.object().required(),
  });

  const updateSchema = Joi.object({
    name: Joi.string().trim().optional(),
    content: Joi.object().optional(),
  }).min(1);

  const validateBody = (schema) => (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, { stripUnknown: true });
      if (error) {
        return next(
          new AppError(
            'Validation failed',
            400,
            error.details.map((d) => d.message),
          ),
        );
      }
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };

  // Static routes first
  router.get('/', verifyToken, requireRole(readRoles), (req, res, next) =>
    controller.list(req, res, next, kitchenRepository),
  );

  router.post(
    '/',
    verifyToken,
    requireRole(writeRoles),
    validateBody(createSchema),
    (req, res, next) => controller.create(req, res, next, kitchenRepository),
  );

  router.post(
    '/validate',
    verifyToken,
    requireRole(writeRoles),
    (req, res, next) => controller.validate(req, res, next), //The body will be validated by the domain service/schema.
  );

  router.get('/active', verifyToken, requireRole(readRoles), (req, res, next) =>
    controller.getActive(req, res, next, kitchenRepository),
  );

  // Dynamic routes (with :id) after
  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, kitchenRepository),
  );

  router.patch(
    '/:id',
    verifyToken,
    requireRole(writeRoles),
    validateId,
    validateBody(updateSchema),
    (req, res, next) => controller.update(req, res, next, kitchenRepository),
  );

  router.delete('/:id', verifyToken, requireRole(writeRoles), validateId, (req, res, next) =>
    controller.remove(req, res, next, kitchenRepository),
  );

  router.patch(
    '/:id/activate',
    verifyToken,
    requireRole(writeRoles),
    validateId,
    (req, res, next) => controller.activate(req, res, next, kitchenRepository),
  );

  return router;
}