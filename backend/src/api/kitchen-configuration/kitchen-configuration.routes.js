import { Router } from 'express';
import Joi from 'joi';
import * as controller from './kitchen-configuration.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

export default function kitchenConfigurationRouterFactory(kitchenRepo) {
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

  const createConfigSchema = Joi.object({
    name: Joi.string().trim().required(),
    content: Joi.object().required(),
  });

  const updateConfigSchema = Joi.object({
    name: Joi.string().trim().optional(),
    content: Joi.object().optional(),
  }).min(1);

  router.get('/', verifyToken, requireRole(readRoles), (req, res, next) =>
    controller.list(req, res, next, kitchenRepo),
  );

  router.post(
    '/',
    verifyToken,
    requireRole(writeRoles),
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

  router.post('/validate', verifyToken, requireRole(writeRoles), (req, res, next) =>
    controller.validate(req, res, next),
  );

  router.get('/active', verifyToken, requireRole(readRoles), (req, res, next) =>
    controller.getActive(req, res, next, kitchenRepo),
  );

  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, kitchenRepo),
  );

  router.patch(
    '/:id',
    verifyToken,
    requireRole(writeRoles),
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

  router.delete('/:id', verifyToken, requireRole(writeRoles), validateId, (req, res, next) =>
    controller.remove(req, res, next, kitchenRepo),
  );

  router.patch(
    '/:id/activate',
    verifyToken,
    requireRole(writeRoles),
    validateId,
    (req, res, next) => controller.activate(req, res, next, kitchenRepo),
  );

  return router;
}
