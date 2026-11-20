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

/** Wraps an async handler: errors go to the error handler, role denials are logged first. */
const handle =
  (fn, { status = 200, logDenial = false } = {}) =>
  async (req, res, next) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      if (logDenial) logRoleChangeDenied(req, err, req.params?.id ?? null);
      next(err);
    }
  };

/** GET /users */
export const list = (usersService) => handle(() => usersService.listUsers());

/** GET /users/assignable-roles */
export const assignableRoles = (usersService) =>
  handle(async (req) => ({ roles: usersService.listAssignableRoles(req.user) }));

/** POST /users: inactive account + activation invitation (AA06). */
export const create = (usersService) =>
  handle((req) => usersService.createUser(req.user, req.body), { status: 201, logDenial: true });

/** GET /users/:id */
export const getById = (usersService) => handle((req) => usersService.getUserById(req.params.id));

/** PATCH /users/:id. Nobody changes their own active status. */
export const update = (usersService) =>
  handle(async (req) => {
    if (req.user.userId === req.params.id.toLowerCase() && req.body.isActive !== undefined) {
      throw new AppError('You cannot change your own active status.', 403);
    }
    return usersService.updateUser(req.params.id, req.body);
  });

/** PUT /users/:id/roles/:role */
export const addRole = (usersService) =>
  handle((req) => usersService.addRole(req.user, req.params.id, req.params.role), {
    logDenial: true,
  });

/** DELETE /users/:id/roles/:role */
export const removeRole = (usersService) =>
  handle((req) => usersService.removeRole(req.user, req.params.id, req.params.role), {
    logDenial: true,
  });

/** GET /users/:id/role-history */
export const roleHistory = (usersService) =>
  handle((req) => usersService.getRoleHistory(req.params.id));

/** POST /users/:id/invitation: replaces the activation invitation (AA06). */
export const reissueInvitation = (usersService) =>
  handle((req) => usersService.reissueInvitation(req.user, req.params.id), { status: 201 });
