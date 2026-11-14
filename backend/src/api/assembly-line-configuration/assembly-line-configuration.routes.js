import { Router } from 'express';
import Joi from 'joi';
import * as controller from './assembly-line-configuration.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
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
  const readRoles = [Roles.MANAGER, Roles.EMPLOYEE];
  const writeRoles = [Roles.MANAGER];

  router.get('/', verifyToken, requireRole(readRoles), (req, res, next) =>
    controller.list(req, res, next, assemblyLineRepo),
  );
  router.post(
    '/',
    verifyToken,
    requireRole(writeRoles),
    validateBody(createConfigSchema),
    (req, res, next) => controller.create(req, res, next, assemblyLineRepo),
  );
  router.post('/validate', verifyToken, requireRole(writeRoles), (req, res, next) =>
    controller.validate(req, res, next),
  );
  router.get('/:id', verifyToken, requireRole(readRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, assemblyLineRepo),
  );
  router.patch(
    '/:id',
    verifyToken,
    requireRole(writeRoles),
    validateId,
    validateBody(updateConfigSchema),
    (req, res, next) => controller.update(req, res, next, assemblyLineRepo),
  );
  router.delete('/:id', verifyToken, requireRole(writeRoles), validateId, (req, res, next) =>
    controller.remove(req, res, next, assemblyLineRepo),
  );

  return router;
}
