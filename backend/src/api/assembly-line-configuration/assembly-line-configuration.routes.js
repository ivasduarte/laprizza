import { Router } from 'express';
import Joi from 'joi';
import * as controller from './assembly-line-configuration.controller.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';

const objectIdSchema = Joi.string().hex().length(24);

const createConfigSchema = Joi.object({
  name: Joi.string().trim().required(),
  content: Joi.object().required(),
});

const updateConfigSchema = Joi.object({
  name: Joi.string().trim().optional(),
  content: Joi.object().optional(),
}).min(1);

function validateId(req, res, next) {
  const { error } = objectIdSchema.validate(req.params.id);
  if (error) return next(new AppError('Invalid ID format', 400));
  next();
}

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) {
      return next(
        new AppError(
          'Validation error',
          400,
          error.details.map((d) => d.message),
        ),
      );
    }
    req.body = value;
    next();
  };
}

/**
 * Assembly line configurations are a library of line definitions. They have no
 * active state of their own: the active kitchen configuration references the line
 * to display (WEB06 "resolvable back-end references").
 */
export default function assemblyLineConfigurationRouterFactory(assemblyLineRepo) {
  const router = Router();
  const canRead = requirePermission(Permission.KITCHEN_READ);
  const canWrite = requirePermission(Permission.KITCHEN_WRITE);

  router.get('/', canRead, (req, res, next) =>
    controller.list(req, res, next, assemblyLineRepo),
  );
  router.post(
    '/',
    canWrite,
    validateBody(createConfigSchema),
    (req, res, next) => controller.create(req, res, next, assemblyLineRepo),
  );
  router.post('/validate', canWrite, (req, res, next) =>
    controller.validate(req, res, next),
  );
  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, assemblyLineRepo),
  );
  router.patch(
    '/:id',
    canWrite,
    validateId,
    validateBody(updateConfigSchema),
    (req, res, next) => controller.update(req, res, next, assemblyLineRepo),
  );
  router.delete('/:id', canWrite, validateId, (req, res, next) =>
    controller.remove(req, res, next, assemblyLineRepo),
  );

  return router;
}
