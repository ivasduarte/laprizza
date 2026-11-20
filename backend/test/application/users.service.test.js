import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import { createUsersService, toUserDto } from '../../src/application/users/users.service.js';
import { permissionsFor } from '../../src/domain/auth/permissions.domain.js';
import { createPasswordHasher } from '../../src/infrastructure/security/password-hasher.js';

const USER_ID = 'abcdef000000000000000001';
const ADMIN = {
  userId: 'abcdef000000000000000099',
  permissions: permissionsFor(['ADMINISTRATOR']),
};
const MANAGER = { userId: 'abcdef000000000000000098', permissions: permissionsFor(['MANAGER']) };
const EMPLOYEE_ASSIGNER = {
  userId: 'abcdef000000000000000097',
  permissions: ['users:read', 'roles:assign:employee'],
};
const INVITATION = { expiresAt: new Date('2026-11-23T10:00:00Z'), sent: true };
// Fast hasher: these tests check what is stored, not the cost parameters.
const passwordHasher = createPasswordHasher({
  type: argon2.argon2id,
  memoryCost: 1024,
  timeCost: 2,
  parallelism: 1,
});

/** Stored user document (as returned by the real repository). */
const storedUser = (data = {}) => ({
  _id: USER_ID,
  email: 'user@laprizza.pt',
  roles: ['CUSTOMER', 'EMPLOYEE'],
  status: 'active',
  activatedAt: new Date('2026-01-01T00:00:00Z'),
  passwordHash: '$argon2id$stored',
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
  ...data,
});

/** Service with an in-memory user: the conditional role updates behave as in MongoDB. */
function build(user = storedUser()) {
  let current = user;
  const usersRepository = {
    listUsers: mock.fn(async () => [current]),
    findById: mock.fn(async (id) =>
      current && String(id) === String(current._id) ? current : null,
    ),
    create: mock.fn(async (data) => ({ _id: 'abcdef0000000000000000ce', ...data })),
    deleteById: mock.fn(async () => ({ deletedCount: 1 })),
    update: mock.fn(async (_id, data) => ({ ...current, ...data })),
    addRoleIfAbsent: mock.fn(async (_id, role) => {
      if (current.roles.includes(role)) return null;
      current = { ...current, roles: [...current.roles, role] };
      return current;
    }),
    removeRoleIfPresent: mock.fn(async (_id, role, { clearCustomerId = false } = {}) => {
      if (!current.roles.includes(role)) return null;
      current = {
        ...current,
        roles: current.roles.filter((r) => r !== role),
        ...(clearCustomerId ? { customerId: null } : {}),
      };
      return current;
    }),
  };
  const roleChangeRecorder = {
    recordInitialRoles: mock.fn(async () => {}),
    record: mock.fn(async () => {}),
    history: mock.fn(async () => []),
  };
  const invitationService = {
    issue: mock.fn(async () => INVITATION),
    revokePending: mock.fn(async () => {}),
  };
  const securityLogger = { log: mock.fn() };
  const service = createUsersService({
    usersRepository,
    roleChangeRecorder,
    invitationService,
    securityLogger,
    passwordHasher,
  });
  return { service, usersRepository, roleChangeRecorder, invitationService, securityLogger };
}

const rejectsWith = (promise, status, code) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    if (code) assert.equal(err.code, code);
    return true;
  });

const loggedEvents = (logger) => logger.log.mock.calls.map((c) => c.arguments[0]);

/* --------------------------------------------------------------------- */
/* DTO, list, get                                                        */
/* --------------------------------------------------------------------- */

test('toUserDto hides secrets, derives isActive and flags accounts waiting for activation', () => {
  const dto = toUserDto(storedUser({ status: 'disabled', tokenVersion: 3, failedLoginCount: 2 }));
  assert.equal(dto.passwordHash, undefined);
  assert.equal(dto.tokenVersion, undefined);
  assert.equal(dto.failedLoginCount, undefined);
  assert.equal(dto.isActive, false);
  assert.equal(dto.pendingActivation, false);
  assert.equal(
    toUserDto({ _id: 'u2', status: 'inactive', activatedAt: null }).pendingActivation,
    true,
  );
  assert.deepEqual(toUserDto({ _id: 'u3', status: 'active' }).roles, []);
});

test('listUsers returns DTOs and getUserById answers 404 for unknown users', async () => {
  const { service } = build();
  const [user] = await service.listUsers();
  assert.equal(user.email, 'user@laprizza.pt');
  assert.equal(user.passwordHash, undefined);
  assert.equal((await service.getUserById(USER_ID)).id, USER_ID);
  await rejectsWith(service.getUserById('abcdef000000000000000999'), 404);
});

/* --------------------------------------------------------------------- */
/* AA06 - account creation                                               */
/* --------------------------------------------------------------------- */

test('AA06: createUser stores an INACTIVE account without a password, with CUSTOMER and the requested roles', async () => {
  const { service, usersRepository } = build();
  const dto = await service.createUser(ADMIN, {
    email: '  Joao@LaPrizza.pt ',
    username: 'Joao',
    roles: ['EMPLOYEE'],
  });

  const stored = usersRepository.create.mock.calls[0].arguments[0];
  assert.equal(stored.email, 'joao@laprizza.pt');
  assert.equal(stored.username, 'joao');
  assert.equal(stored.status, 'inactive');
  assert.equal(stored.activatedAt, null);
  assert.equal(stored.passwordHash, undefined);
  assert.deepEqual(stored.roles, ['CUSTOMER', 'EMPLOYEE']);
  assert.equal(dto.pendingActivation, true);
  assert.equal(dto.isActive, false);
  assert.deepEqual(dto.invitation, INVITATION);
});

test('AA06: createUser records the roles (CUSTOMER by AA03, the rest by the Administrator) and invites the account', async () => {
  const { service, roleChangeRecorder, invitationService } = build();
  await service.createUser(ADMIN, { email: 'new@laprizza.pt', roles: ['MANAGER'] });

  const [user, actor] = roleChangeRecorder.recordInitialRoles.mock.calls[0].arguments;
  assert.deepEqual(user.roles, ['CUSTOMER', 'MANAGER']);
  assert.deepEqual(actor, { kind: 'USER', userId: ADMIN.userId });

  const [invited, { issuedBy }] = invitationService.issue.mock.calls[0].arguments;
  assert.equal(invited.email, 'new@laprizza.pt');
  assert.deepEqual(issuedBy, { kind: 'USER', userId: ADMIN.userId });
});

test('AA06: only an Administrator creates accounts with roles; nobody gets ADMINISTRATOR by registering', async () => {
  const { service, usersRepository } = build();
  await rejectsWith(
    service.createUser(MANAGER, { email: 'x@laprizza.pt', roles: ['ADMINISTRATOR'] }),
    403,
    'ROLE_NOT_ASSIGNABLE',
  );
  await rejectsWith(
    service.createUser(EMPLOYEE_ASSIGNER, { email: 'x@laprizza.pt', roles: ['MANAGER'] }),
    403,
    'ROLE_NOT_ASSIGNABLE',
  );
  assert.equal(usersRepository.create.mock.callCount(), 0);
});

test('createUser requires an email and answers 409 for a duplicate', async () => {
  const { service, usersRepository } = build();
  await rejectsWith(service.createUser(ADMIN, { username: 'semEmail' }), 400);
  usersRepository.create.mock.mockImplementation(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000 });
  });
  await rejectsWith(service.createUser(ADMIN, { email: 'dup@laprizza.pt' }), 409);
});

test('AA06: if the roles cannot be recorded, the account is removed and nothing is sent', async () => {
  const { service, usersRepository, roleChangeRecorder, invitationService, securityLogger } =
    build();
  roleChangeRecorder.recordInitialRoles.mock.mockImplementation(async () => {
    throw new Error('db down');
  });

  await rejectsWith(service.createUser(ADMIN, { email: 'new@laprizza.pt' }), 503);
  assert.equal(usersRepository.deleteById.mock.callCount(), 1);
  assert.equal(invitationService.issue.mock.callCount(), 0);
  assert.ok(loggedEvents(securityLogger).includes('ROLE_CHANGE_RECORD_FAILED'));
});

test('AA06: if the invitation fails, the account is kept and the answer says it was not sent', async () => {
  const { service, invitationService, securityLogger } = build();
  invitationService.issue.mock.mockImplementation(async () => {
    throw new Error('db down');
  });

  const dto = await service.createUser(ADMIN, { email: 'new@laprizza.pt' });
  assert.deepEqual(dto.invitation, { expiresAt: null, sent: false });
  assert.ok(loggedEvents(securityLogger).includes('ACTIVATION_INVITATION_FAILED'));
});

/* --------------------------------------------------------------------- */
/* Status and password                                                   */
/* --------------------------------------------------------------------- */

test('AA06: disabling revokes the sessions and the pending invitations', async () => {
  const { service, usersRepository, invitationService } = build();
  const dto = await service.updateUser(USER_ID, { isActive: false });

  assert.equal(dto.status, 'disabled');
  assert.deepEqual(usersRepository.update.mock.calls[0].arguments[1], {
    status: 'disabled',
    tokenVersion: 1,
  });
  assert.equal(invitationService.revokePending.mock.callCount(), 1);
});

test('AA06: an activated account can be re-enabled without revoking sessions', async () => {
  const { service, usersRepository, invitationService } = build(storedUser({ status: 'disabled' }));
  const dto = await service.updateUser(USER_ID, { isActive: true });
  assert.equal(dto.status, 'active');
  assert.deepEqual(usersRepository.update.mock.calls[0].arguments[1], { status: 'active' });
  assert.equal(invitationService.revokePending.mock.callCount(), 0);
});

test('AA06: an account never activated cannot be enabled by an Administrator (ACTIVATION_REQUIRED)', async () => {
  for (const status of ['inactive', 'disabled']) {
    const { service, usersRepository } = build(storedUser({ status, activatedAt: null }));
    await rejectsWith(service.updateUser(USER_ID, { isActive: true }), 409, 'ACTIVATION_REQUIRED');
    assert.equal(usersRepository.update.mock.callCount(), 0);
  }
});

test('updateUser hashes a new password, resets lockout and revokes sessions', async () => {
  const { service, usersRepository } = build(
    storedUser({ failedLoginCount: 4, lockedUntil: new Date() }),
  );
  await service.updateUser(USER_ID, { password: 'NewStrongPassword123!' });

  const patch = usersRepository.update.mock.calls[0].arguments[1];
  assert.equal(await argon2.verify(patch.passwordHash, 'NewStrongPassword123!'), true);
  assert.equal(patch.failedLoginCount, 0);
  assert.equal(patch.lockedUntil, null);
  assert.equal(patch.tokenVersion, 1);
});

test('updateUser rejects weak passwords, ignores role fields and answers 404 for unknown users', async () => {
  const { service, usersRepository } = build();
  await rejectsWith(
    service.updateUser(USER_ID, { password: '123' }),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  await service.updateUser(USER_ID, { roles: ['ADMINISTRATOR'], role: 'MANAGER', isActive: true });
  assert.deepEqual(usersRepository.update.mock.calls[0].arguments[1], { status: 'active' });
  await rejectsWith(service.updateUser('abcdef000000000000000999', { isActive: false }), 404);
});

/* --------------------------------------------------------------------- */
/* AA06 - role assignment and removal                                    */
/* --------------------------------------------------------------------- */

test('AA06: assigning a role records the Administrator and never requires reactivation', async () => {
  const { service, usersRepository, roleChangeRecorder, invitationService } = build();
  const dto = await service.addRole(ADMIN, USER_ID, 'MANAGER');

  assert.deepEqual(dto.roles, ['CUSTOMER', 'EMPLOYEE', 'MANAGER']);
  assert.equal(dto.status, 'active');
  assert.deepEqual(roleChangeRecorder.record.mock.calls[0].arguments[0], {
    userId: USER_ID,
    role: 'MANAGER',
    action: 'ASSIGNED',
    actor: { kind: 'USER', userId: ADMIN.userId },
  });
  assert.equal(usersRepository.update.mock.callCount(), 0); // status untouched
  assert.equal(invitationService.issue.mock.callCount(), 0); // no new activation
});

test('AA06: assigning a role the user already has changes and records nothing', async () => {
  const { service, roleChangeRecorder } = build();
  const dto = await service.addRole(ADMIN, USER_ID, 'EMPLOYEE');
  assert.deepEqual(dto.roles, ['CUSTOMER', 'EMPLOYEE']);
  assert.equal(roleChangeRecorder.record.mock.callCount(), 0);
});

test('AA06: role changes are limited to authorized administrators, never on oneself', async () => {
  const { service, usersRepository } = build();
  await rejectsWith(service.addRole(MANAGER, USER_ID, 'MANAGER'), 403, 'ROLE_NOT_ASSIGNABLE');
  await rejectsWith(service.removeRole(MANAGER, USER_ID, 'EMPLOYEE'), 403, 'ROLE_NOT_ASSIGNABLE');
  const self = { ...ADMIN, userId: USER_ID };
  await rejectsWith(service.addRole(self, USER_ID, 'MANAGER'), 403, 'SELF_ROLE_CHANGE');
  await rejectsWith(service.removeRole(self, USER_ID, 'EMPLOYEE'), 403, 'SELF_ROLE_CHANGE');
  assert.equal(usersRepository.addRoleIfAbsent.mock.callCount(), 0);
  assert.equal(usersRepository.removeRoleIfPresent.mock.callCount(), 0);
});

test('AA06: an assignment that cannot be recorded is undone (503)', async () => {
  const { service, usersRepository, roleChangeRecorder } = build();
  roleChangeRecorder.record.mock.mockImplementation(async () => {
    throw new Error('db down');
  });
  await rejectsWith(service.addRole(ADMIN, USER_ID, 'MANAGER'), 503);
  assert.deepEqual(usersRepository.removeRoleIfPresent.mock.calls[0].arguments, [
    USER_ID,
    'MANAGER',
  ]);
});

test('AA06: removing a role records it; removing CUSTOMER also clears customerId', async () => {
  const { service, usersRepository, roleChangeRecorder } = build(
    storedUser({ customerId: '65231abcd345678901234567' }),
  );
  const dto = await service.removeRole(ADMIN, USER_ID, 'CUSTOMER');

  assert.deepEqual(dto.roles, ['EMPLOYEE']);
  assert.equal(dto.customerId, null);
  assert.deepEqual(usersRepository.removeRoleIfPresent.mock.calls[0].arguments[2], {
    clearCustomerId: true,
  });
  assert.equal(roleChangeRecorder.record.mock.calls[0].arguments[0].action, 'REMOVED');
});

test('AA06: a removal is never undone, even if it cannot be recorded (logged instead)', async () => {
  const { service, usersRepository, roleChangeRecorder, securityLogger } = build();
  roleChangeRecorder.record.mock.mockImplementation(async () => {
    throw new Error('db down');
  });
  const dto = await service.removeRole(ADMIN, USER_ID, 'EMPLOYEE');
  assert.deepEqual(dto.roles, ['CUSTOMER']);
  assert.equal(usersRepository.addRoleIfAbsent.mock.callCount(), 0);
  const failure = securityLogger.log.mock.calls.find(
    (c) => c.arguments[0] === 'ROLE_CHANGE_RECORD_FAILED',
  );
  assert.equal(failure.arguments[1].removedBy, ADMIN.userId);
});

test('addRole and removeRole answer 404 for unknown users', async () => {
  const { service } = build();
  const unknown = 'abcdef000000000000000999';
  await rejectsWith(service.addRole(ADMIN, unknown, 'EMPLOYEE'), 404);
  await rejectsWith(service.removeRole(ADMIN, unknown, 'EMPLOYEE'), 404);
});

/* --------------------------------------------------------------------- */
/* AA06 - history, invitation replacement, assignable roles              */
/* --------------------------------------------------------------------- */

test('AA06: the role history shows who changed each role and when', async () => {
  const { service, roleChangeRecorder } = build();
  const at = new Date('2026-11-20T10:00:00Z');
  roleChangeRecorder.history.mock.mockImplementation(async () => [
    { role: 'MANAGER', action: 'ASSIGNED', actor: { kind: 'USER', userId: ADMIN.userId }, at },
    {
      role: 'CUSTOMER',
      action: 'ASSIGNED',
      actor: { kind: 'SYSTEM', process: 'initial-customer-role' },
      at,
    },
  ]);

  assert.deepEqual(await service.getRoleHistory(USER_ID), [
    {
      role: 'MANAGER',
      action: 'ASSIGNED',
      actor: { kind: 'USER', userId: ADMIN.userId, process: null },
      at,
    },
    {
      role: 'CUSTOMER',
      action: 'ASSIGNED',
      actor: { kind: 'SYSTEM', userId: null, process: 'initial-customer-role' },
      at,
    },
  ]);
  await rejectsWith(service.getRoleHistory('abcdef000000000000000999'), 404);
});

test('AA06: an Administrator issues a replacement invitation in their name', async () => {
  const { service, invitationService } = build(
    storedUser({ status: 'inactive', activatedAt: null }),
  );
  assert.deepEqual(await service.reissueInvitation(ADMIN, USER_ID), INVITATION);
  assert.deepEqual(invitationService.issue.mock.calls[0].arguments[1], {
    issuedBy: { kind: 'USER', userId: ADMIN.userId },
  });
  await rejectsWith(service.reissueInvitation(ADMIN, 'abcdef000000000000000999'), 404);
});

test('AA06: assignable roles follow the actor permissions', () => {
  const { service } = build();
  assert.deepEqual(service.listAssignableRoles(ADMIN).sort(), [
    'ADMINISTRATOR',
    'CUSTOMER',
    'EMPLOYEE',
    'MANAGER',
  ]);
  assert.deepEqual(service.listAssignableRoles(MANAGER), []);
  assert.deepEqual(service.listAssignableRoles(undefined), []);
});
