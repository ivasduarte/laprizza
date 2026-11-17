import { Router } from 'express';
import Joi from 'joi';
import * as controller from './kitchen-configuration.controller.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

export default function kitchenConfigurationRouterFactory(kitchenRepo) {
  const router = Router();
  const canRead = requirePermission(Permission.KITCHEN_READ);
  const canWrite = requirePermission(Permission.KITCHEN_WRITE);

  const objectIdSchema = Joi.string().hex().length(24).messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const createConfigSchema = Joi.object({
    name: Joi.string().trim().required(),
    content: Joi.object().required(),
  });

  const updateConfigSchema = Joi.object({
    name: Joi.string().trim().optional(),
    content: Joi.object().optional(),
  }).min(1);

  router.get('/', canRead, (req, res, next) =>
    controller.list(req, res, next, kitchenRepo),
  );

  router.post(
    '/',
    canWrite,
    async (req, res, next) => {
      try {
        const { error, value } = createConfigSchema.validate(req.body, { stripUnknown: true });
        if (error) {
          return next(new AppError('Validation error', 400, joiDetails(error)));
        }
        req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.create(req, res, next, kitchenRepo),
  );

  router.post('/validate', canWrite, (req, res, next) =>
    controller.validate(req, res, next),
  );

  router.get('/active', canRead, (req, res, next) =>
    controller.getActive(req, res, next, kitchenRepo),
  );

  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, kitchenRepo),
  );

  router.patch(
    '/:id',
    canWrite,
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateConfigSchema.validate(req.body, { stripUnknown: true });
        if (error) {
          return next(new AppError('Validation error', 400, joiDetails(error)));
        }
        req.body = value;
        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.update(req, res, next, kitchenRepo),
  );

  router.delete('/:id', canWrite, validateId, (req, res, next) =>
    controller.remove(req, res, next, kitchenRepo),
  );

  router.patch(
    '/:id/activate',
    canWrite,
    validateId,
    (req, res, next) => controller.activate(req, res, next, kitchenRepo),
  );

  return router;
}
