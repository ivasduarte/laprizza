import Joi from 'joi';
import * as controller from './product-categories.controller.js';

import { Router } from 'express';
import { AppError } from '../../application/app-error.js';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';

/**
 * Factory function that creates and configures the Express router for product categories endpoint.
 * Injects the repositories into the controllers.
 * Enforces authentication, role-based access control (Manager only), and payload validation using Joi.
 *
 * @param {Object} productCategoriesRepository - The injected repository for product category data base operations.
 * @param {Object} productsRepository - The injected repository for product database operations, used to check whether a category is referenced by products before removing it.
 * @returns {import('express').Router} The configured Express router.
 */
export default function productCategoriesRouterFactory(
  productCategoriesRepository,
  productsRepository,
) {
  const router = Router();

  // The name is only checked for presence and type here: normalization and blank-value rules belong to the domain.
  const nameSchema = Joi.string().trim().required().messages({
    'string.base': 'Name must be a text.',
    'string.empty': 'Name is required.',
    'any.required': 'Mandatory field',
  });

  const productCategorySchema = Joi.object({
    name: nameSchema,
  });

  const searchProductCategorySchema = Joi.object({
    name: Joi.string().trim().allow('').optional().messages({
      'string.base': 'Name must be a text.',
    }),
  });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format.',
    'string.length': 'Invalid ID format.',
  });

  /**
   * Express middleware to validate MongoDB ObjectId format in route parameters.
   * Prevents CastErrors from the database layer by stopping malformed IDs early.
   *
   * @param {import('express').Request} req - The Express request object.
   * @param {import('express').Response} res - The Express response object.
   * @param {import('express').NextFunction} next - The Express next middleware function.
   */
  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  // List or search by exact name
  router.get(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error } = searchProductCategorySchema.validate(req.query, {
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

        next();
      } catch (err) {
        next(err);
      }
    },
    (req, res, next) => controller.list(req, res, next, productCategoriesRepository),
  );

  // Create a new product category
  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error, value } = productCategorySchema.validate(req.body, {
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
    (req, res, next) => controller.create(req, res, next, productCategoriesRepository),
  );

  // Get by ID
  router.get('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, (req, res, next) =>
    controller.getById(req, res, next, productCategoriesRepository),
  );

  // Update the descriptive name
  router.put(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = productCategorySchema.validate(req.body, {
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
    (req, res, next) => controller.update(req, res, next, productCategoriesRepository),
  );

  // Remove; blocked while products reference the category
  router.delete('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, (req, res, next) =>
    controller.remove(req, res, next, productCategoriesRepository, productsRepository),
  );

  return router;
}
