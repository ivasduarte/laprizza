import { Router } from 'express';
import * as controller from './product-catalogue.controller.js';
import Joi from 'joi';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';

export default function catalogueRouterFactory(repos) {
  const router = Router();
  const allowedRoles = [Roles.CUSTOMER, Roles.MANAGER, Roles.EMPLOYEE];

  const objectIdSchema = Joi.string().hex().length(24).messages({
    'string.hex': 'Invalid ID format.',
    'string.length': 'Invalid ID format.',
  });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format.', 400));
    next();
  };

  const listCatalogueQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').optional(),
    categoryId: objectIdSchema.optional(),
  });

  const validateListQuery = (req, res, next) => {
    const { error, value } = listCatalogueQuerySchema.validate(
      { ...req.query },
      { allowUnknown: true, stripUnknown: true },
    );
    if (error)
      return next(
        new AppError(
          'Validation failed.',
          400,
          error.details.map((d) => d.message),
        ),
      );
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };

  router.get('/', verifyToken, requireRole(allowedRoles), validateListQuery, (req, res, next) =>
    controller.list(req, res, next, repos),
  );
  router.get('/:id', verifyToken, requireRole(allowedRoles), validateId, (req, res, next) =>
    controller.getById(req, res, next, repos),
  );

  return router;
}
