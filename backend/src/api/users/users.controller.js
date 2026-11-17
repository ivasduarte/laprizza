import * as usersService from '../../application/users/users.service.js';
import * as authService from '../../application/auth/auth.service.js';
import { AppError } from '../../application/app-error.js';
import { RoleChangeDenial } from '../../domain/auth/permissions.domain.js';

const ROLE_CHANGE_DENIALS = new Set(Object.values(RoleChangeDenial));

/**
 * Records a refused role change for investigation (who, on whom, which roles, why).
 * Only the request path is logged: never the body, headers or query.
 */
function logRoleChangeDenied(req, err, targetUserId) {
  if (err?.status !== 403 || !ROLE_CHANGE_DENIALS.has(err.code)) return;
  req.app?.locals?.securityLogger?.log('ACCESS_DENIED', {
    userId: req.user?.userId,
    roles: req.user?.roles,
    targetUserId: targetUserId ?? undefined,
    attemptedRoles: err.details?.roles,
    ip: req.ip,
    method: req.method,
    path: `${req.baseUrl ?? ''}${req.path ?? ''}`,
    reason: err.code,
  });
}

/** GET /users */
export const list = async (req, res, next, usersRepository) => {
  try {
    res.status(200).json(await usersService.listUsers(usersRepository));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /users. The initial roles follow the same rule as adding roles:
 * the actor must be allowed to assign each of them.
 */
export const create = async (req, res, next, usersRepository) => {
  try {
    usersService.assertRoleChangeAllowed(req.user, null, [], req.body.roles ?? []);
    const newUser = await authService.registerUser(req.body, usersRepository);
    res.status(201).json(newUser);
  } catch (err) {
    logRoleChangeDenied(req, err, null);
    next(err);
  }
};

/** GET /users/:id */
export const getById = async (req, res, next, usersRepository) => {
  try {
    res.status(200).json(await usersService.getUserById(req.params.id, usersRepository));
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /users/:id (password and active status; roles have their own endpoints).
 * Nobody changes their own active status.
 */
export const update = async (req, res, next, usersRepository) => {
  try {
    if (req.user.userId === req.params.id.toLowerCase() && req.body.isActive !== undefined) {
      throw new AppError('You cannot change your own active status.', 403);
    }
    const updatedUser = await usersService.updateUser(req.params.id, req.body, usersRepository);
    res.status(200).json(updatedUser);
  } catch (err) {
    next(err);
  }
};

/** PUT /users/:id/roles/:role */
export const addRole = async (req, res, next, usersRepository) => {
  try {
    const user = await usersService.addRole(
      req.user,
      req.params.id,
      req.params.role,
      usersRepository,
    );
    res.status(200).json(user);
  } catch (err) {
    logRoleChangeDenied(req, err, req.params.id);
    next(err);
  }
};

/** DELETE /users/:id/roles/:role */
export const removeRole = async (req, res, next, usersRepository) => {
  try {
    const user = await usersService.removeRole(
      req.user,
      req.params.id,
      req.params.role,
      usersRepository,
    );
    res.status(200).json(user);
  } catch (err) {
    logRoleChangeDenied(req, err, req.params.id);
    next(err);
  }
};
