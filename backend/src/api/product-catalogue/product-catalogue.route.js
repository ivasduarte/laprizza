import { Router } from 'express';
import * as controller from './product-catalogue.controller.js';
import Joi from 'joi';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';

export default function catalogueRouterFactory(repos) {
  const router = Router();

  const canRead = requirePermission(Permission.CATALOGUE_READ);

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
    if (error) return next(new AppError('Validation failed.', 400, joiDetails(error)));
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };

  router.get('/', canRead, validateListQuery, (req, res, next) =>
    controller.list(req, res, next, repos),
  );
  router.get('/:id', canRead, validateId, (req, res, next) =>
    controller.getById(req, res, next, repos),
  );

  return router;
}
