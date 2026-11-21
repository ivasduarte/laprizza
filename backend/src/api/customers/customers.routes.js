import Joi from 'joi';
import * as controller from './customers.controller.js';

import { Router } from 'express';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import {
  CUSTOMER_FIELD_LIMITS as LIMITS,
  PERSON_NAME_PATTERN,
  PLACE_NAME_PATTERN,
} from '../../domain/customers/customers.domain.js';

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

  // WEB04: every field has a length limit; names only accept letters between their words.
  const placeName = (max) => Joi.string().trim().max(max).pattern(PLACE_NAME_PATTERN, 'placeName');
  const addressSchema = Joi.object({
    street: Joi.string().trim().max(LIMITS.street).required(),
    houseNumber: Joi.string().trim().max(LIMITS.houseNumber).required(),
    complement: Joi.string().trim().max(LIMITS.complement).optional(),
    postalCode: Joi.string()
      .pattern(/^\d{4}-\d{3}$/)
      .required(),
    city: placeName(LIMITS.city).required(),
    district: placeName(LIMITS.district).required(),
  });
  const personName = () =>
    Joi.string().trim().min(3).max(LIMITS.name).pattern(PERSON_NAME_PATTERN, 'personName');

  const createCustomerSchema = Joi.object({
    name: personName().required().messages({
      'any.required': 'Mandatory field.',
    }),
    email: Joi.string().email().trim().max(LIMITS.email).required().messages({
      'any.required': 'Mandatory field.',
    }),
    phoneNumber: Joi.string().max(LIMITS.phoneNumber).required(),
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
      return next(new AppError('Validation failed', 400, joiDetails(error)));
    }
    next();
  };

  router.get(
    '/',
    requirePermission(Permission.CUSTOMERS_READ),
    validateListQuery,
    (req, res, next) => controller.list(req, res, next, customersRepository),
  );

  // Create a new customer
  router.post(
    '/',
    requirePermission(Permission.CUSTOMERS_WRITE),
    async (req, res, next) => {
      try {
        const { error, value } = createCustomerSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          return next(new AppError('Validation failed', 400, joiDetails(error)));
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
    name: personName().optional(),
    email: Joi.string().email().trim().max(LIMITS.email).optional(),
    phoneNumber: Joi.string().max(LIMITS.phoneNumber).optional(),
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

  router.get('/me', requirePermission(Permission.CUSTOMERS_READ_OWN), (req, res, next) =>
    controller.getMe(req, res, next, customersRepository),
  );

  // Check by ID (Manager only)
  router.get('/:id', requirePermission(Permission.CUSTOMERS_READ), validateId, (req, res, next) =>
    controller.getById(req, res, next, customersRepository),
  );

  // Change role, password, or disable (Manager only)
  router.patch(
    '/:id',
    requirePermission(Permission.CUSTOMERS_WRITE),
    validateId,
    async (req, res, next) => {
      try {
        const { error, value } = updateCustomerSchema.validate(req.body, { stripUnknown: true });
        if (error) {
          return next(new AppError('Validation failed', 400, joiDetails(error)));
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
