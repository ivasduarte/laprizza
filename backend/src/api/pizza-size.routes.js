import Joi from 'joi';
import * as controller from './pizza-size.controller.js';
import { Router } from 'express';
import { Roles } from '../domain/users.domain.js';
import { AppError } from '../application/AppError.js';
import { requireRole, verifyToken } from './middleware/auth.middleware.js';

export default function sizesRouterFactory(sizeRepository) {
  const router = Router();

  const createSizeSchema = Joi.object({
    name: Joi.string().min(3).max(50).trim().required().messages({
      'any.required': 'Mandatory field.',
    }),
  });

  const listSizesQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').optional(),
  });

  const validateListQuery = (req, res, next) => {
    const { error } = listSizesQuerySchema.validate({ ...req.query }, { allowUnknown: true });
    if (error) {
      return next(
        new AppError(
          'Validation failed',
          400,
          error.details.map((d) => d.message),
        ),
      );
    }
    next();
  };

  router.get('/', verifyToken, requireRole([Roles.MANAGER]), validateListQuery, (req, res, next) =>
    controller.list(req, res, next, sizeRepository),
  );

  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error, value } = createSizeSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
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
    },
    (req, res, next) => controller.create(req, res, next, sizeRepository),
  );

  const updateSizeSchema = Joi.object({
    name: Joi.string().min(3).max(50).trim().optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({ 'object.min': 'You must provide at least one field to update.' });

  const objectIdSchema = Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({ 'string.hex': 'Invalid ID format.', 'string.length': 'Invalid ID format.' });

  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format.', 400));
    next();
  };

  router.get('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, (req, res, next) =>
    controller.getById(req, res, next, sizeRepository),
  );

  router.patch(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateSizeSchema.validate(req.body, { stripUnknown: true });
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
    },
    (req, res, next) => controller.update(req, res, next, sizeRepository),
  );

  return router;
}