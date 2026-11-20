import Joi from 'joi';
import * as controller from './users.controller.js';

import { Router } from 'express';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';

/**
 * User administration endpoints (AA05/AA06, Administrator). Payloads are validated with Joi;
 * the service checks, for each role, that the actor may assign it.
 *
 * @param {{usersService: ReturnType<import('../../application/users/users.service.js').createUsersService>}} deps
 * @returns {import('express').Router}
 */
export default function usersRouterFactory({ usersService }) {
  const router = Router();

  const createUserSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).trim().optional(),
    email: Joi.string().trim().lowercase().email().max(254).required().messages({
      'any.required': 'Mandatory field',
    }),
    // AA06/AA07: the user sets the password while activating the account.
    password: Joi.any().forbidden().messages({
      'any.unknown': 'The password is set by the user through the activation invitation.',
    }),
    roles: Joi.array()
      .items(
        Joi.string()
          .valid(...Object.values(Roles))
          .messages({
            'any.only': `Invalid role. Must be one of: ${Object.values(Roles).join(', ')}.`,
          }),
      )
      .unique()
      .default([])
      .messages({ 'array.unique': 'Duplicate roles are not allowed.' }),
    customerId: Joi.string().hex().length(24).optional().messages({
      'string.hex': 'Invalid customerId format.',
    }),
  });

  const updateUserSchema = Joi.object({
    password: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'You must provide at least one field to update (password or isActive).',
    });

  const objectIdSchema = Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ID format',
    'string.length': 'Invalid ID format',
  });

  const roleParamSchema = Joi.string()
    .valid(...Object.values(Roles))
    .required();

  const validateBody = (schema, options) => (req, _res, next) => {
    const { error, value } = schema.validate(req.body, options);
    if (error) return next(new AppError('Validation failed', 400, joiDetails(error)));
    req.body = value;
    next();
  };

  /** Rejects malformed ObjectIds early (no CastError from the database layer). */
  const validateId = (req, _res, next) => {
    const { error } = objectIdSchema.validate(req.params.id);
    if (error) return next(new AppError('Invalid ID format', 400));
    next();
  };

  const validateRoleParam = (req, _res, next) => {
    const { error } = roleParamSchema.validate(req.params.role);
    if (error) return next(new AppError('Invalid role.', 400));
    next();
  };

  router.get('/', requirePermission(Permission.USERS_READ), controller.list(usersService));

  // Roles the current Administrator may assign (the SPA never hard-codes role names).
  router.get(
    '/assignable-roles',
    requirePermission(Permission.USERS_READ),
    controller.assignableRoles(usersService),
  );

  router.post(
    '/',
    requirePermission(Permission.USERS_CREATE),
    validateBody(createUserSchema, { abortEarly: false, stripUnknown: true }),
    controller.create(usersService),
  );

  router.get(
    '/:id',
    requirePermission(Permission.USERS_READ),
    validateId,
    controller.getById(usersService),
  );

  // Password or active status (roles have their own endpoints).
  router.patch(
    '/:id',
    requirePermission(Permission.USERS_MANAGE),
    validateId,
    validateBody(updateUserSchema, { stripUnknown: true }),
    controller.update(usersService),
  );

  // The service checks roles:assign:<role> for the role in the path.
  router.put(
    '/:id/roles/:role',
    requirePermission(Permission.USERS_READ),
    validateId,
    validateRoleParam,
    controller.addRole(usersService),
  );

  router.delete(
    '/:id/roles/:role',
    requirePermission(Permission.USERS_READ),
    validateId,
    validateRoleParam,
    controller.removeRole(usersService),
  );

  router.get(
    '/:id/role-history',
    requirePermission(Permission.USERS_READ),
    validateId,
    controller.roleHistory(usersService),
  );

  router.post(
    '/:id/invitation',
    requirePermission(Permission.USERS_INVITE),
    validateId,
    controller.reissueInvitation(usersService),
  );

  return router;
}
