import Joi from 'joi';
import * as controller from './auth.controller.js';

import { Router } from 'express';
import { AppError } from '../application/AppError.js';

/**
 * Factory function that creates and configures the Express router for authentication endpoints.
 * Injects the users repository into the controller to maintain dependency inversion.
 * Sets up request payload validation using Joi before passing the request to the controller.
 *
 * @param {Object} [usersRepository] - The injected repository for user-related database operations.
 * @returns {import('express').Router} The configured Express router.
 */
export default function authRouterFactory(usersRepository) {
  const router = Router();

  const loginSchema = Joi.object({
    identifier: Joi.string().required().messages({
      'any.required': 'Mandatory field.',
    }), // Accepts username or email
    password: Joi.string().required().messages({
      'any.required': 'Mandatory field.',
    }),
  });

  router.post(
    '/login',
    async (req, res, next) => {
      try {
        const { error, value } = loginSchema.validate(req.body, {
          abortEarly: false, // returns all errors, not just the first
          stripUnknown: true, // removes schema undefined fields
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
        next(err); // moves onto the global errorHandler in index.js
      }
    },
    (req, res, next) => controller.login(req, res, next, usersRepository),
  );

  return router;
}