import Joi from 'joi';
import * as controller from './customers.controller.js';

import { Router } from 'express';
import { Roles } from '../domain/users.domain.js';
import { AppError } from '../application/AppError.js';
import { requireRole, verifyToken } from './middleware/auth.middleware.js';

/**
 * Factory function that creates and configures the Express router for customer management endpoints.
 * Injects the customer repository into the controllers.
 * Enforces authentication, role-based access control (Manager only), and payload validation using Joi.
 *
* @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected postal code validator.
 * @returns {import('express').Router} The configured Express router.
 */
export default function customersRouterFactory(customersRepository, postalCodeValidator) {
  const router = Router();

  const addressSchema = Joi.object({
    street: Joi.string().required(),
    houseNumber: Joi.string().required(),
    complement: Joi.string().optional(),
    postalCode: Joi.string()
      .pattern(/^\d{4}-\d{3}$/)
      .required(),
    city: Joi.string().required(),
    district: Joi.string().required(),
  });

  const createCustomerSchema = Joi.object({
    name: Joi.string().min(3).max(50).trim().required().messages({
      'any.required': 'Mandatory field.',
    }),
    email: Joi.string().email().trim().required().messages({
      'any.required': 'Mandatory field.',
    }),
    phoneNumber: Joi.string().required(),
    address: addressSchema.required(),
    dietaryRestrictions: Joi.array()
      .items(
        Joi.string().hex().length(24).messages({
          'string.hex': 'Invalid Allergen ID format',
          'string.length': 'Invalid Allergen ID format',
        }),
      )
      .unique()
      .optional(),
  });

  const listCustomersQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').optional(),
  });

  const validateListQuery = (req, res, next) => {
    const { error } = listCustomersQuerySchema.validate({ ...req.query }, { allowUnknown: true });
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
    controller.list(req, res, next, customersRepository),
  );

  // Create a new customer
  router.post(
    '/',
    verifyToken,
    requireRole([Roles.MANAGER]),
    async (req, res, next) => {
      try {
        const { error, value } = createCustomerSchema.validate(req.body, {
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
    (req, res, next) => controller.create(req, res, next, customersRepository, postalCodeValidator),
  );

  const updateCustomerSchema = Joi.object({
    name: Joi.string().min(3).max(50).trim().optional(),
    email: Joi.string().email().trim().optional(),
    phoneNumber: Joi.string().optional(),
    address: addressSchema.optional(),
    dietaryRestrictions: Joi.array()
      .items(
        Joi.string().hex().length(24).messages({
          'string.hex': 'Invalid Allergen ID format',
          'string.length': 'Invalid Allergen ID format',
        }),
      )
      .unique()
      .optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'You must provide at least one field to update.',
    });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  /**
   * Express middleware to validate MongoDB ObjectId format in route parameters.
   * Prevents CastErrors from the database layer by stopping malformed IDs early.
   *
   * @param {import('express').Request} req - The Express request object.
   * @param {import('express').Response} res - The Express response object.
   * @param {import('express').NextFunction} next - The Express next  
   */
  const validateId = (req, res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format.', 400));
    next();
  };

  // Check by ID (Manager only)
  router.get('/:id', verifyToken, requireRole([Roles.MANAGER]), validateId, (req, res, next) =>
    controller.getById(req, res, next, customersRepository),
  );

  // Change role, password, or disable (Manager only)
  router.patch(
    '/:id',
    verifyToken,
    requireRole([Roles.MANAGER]),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateCustomerSchema.validate(req.body, { stripUnknown: true });
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
    (req, res, next) => controller.update(req, res, next, customersRepository, postalCodeValidator),
  );

  return router;
}
