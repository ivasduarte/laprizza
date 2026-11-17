import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import {
  listUsers,
  getUserById,
  updateUser,
  toUserDto,
  addRole,
  removeRole,
} from '../../src/application/users/users.service.js';
import { permissionsFor } from '../../src/domain/auth/permissions.domain.js';

const PASSWORD = 'StrongPassword123!';
const USER_ID = 'abcdef000000000000000001';

/** Stored user document (as returned by the real repository). */
const storedUser = (data = {}) => ({
  _id: USER_ID,
  email: 'user@laprizza.pt',
  roler: ['EMPLOYEE'],
  status: 'active',
  passwordHash: '$argon2id$stored',
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
  ...data,
});

/** Repository with one user: findById returns it and update merges the patch into it. */
function createUsersRepository(user = storedUser()) {
  return {
    listUsers: mock.fn(async () => [user]),
    findById: mock.fn(async (id) => (String(id) === String(user._id) ? user : undefined)),
    update: mock.fn(async (_id, data) => ({ ...user, ...data })),
    addRole: mock.fn(async (_id, role) => ({
      ...user,
      roles: [...new Set([...(user.roles ?? []), role])],
    })),
    removeRole: mock.fn(async (_id, role, { clearCustomerId = false } = {}) => ({
      ...user,
      roles: (user.roles ?? []).filter((r) => r !== role),
      ...(clearCustomerId ? { customerId: null } : {}),
    })),
  };
}

/** Patch sent to usersRepository.update in the given call. */
const savedPatch = (usersRepository, call = 0) =>
  usersRepository.update.mock.calls[call].arguments[1];

/**
 * Unit test: toUserDto never exposes the hash and derives isActive from status.
 */
test('toUserDto hides the password hash and derives isActive from status', () => {
  const dto = toUserDto({
    _id: 'u1',
    email: 'a@b.pt',
    roles: ['EMPLOYEE'],
    status: 'disabled',
    passwordHash: '$argon2id$secret',
    tokenVersion: 3,
    failedLoginCount: 2,
  });

  assert.equal(dto.passwordHash, undefined);
  assert.equal(dto.tokenVersion, undefined);
  assert.equal(dto.failedLoginCount, undefined);
  assert.equal(dto.status, 'disabled');
  assert.equal(dto.isActive, false);
  assert.deepEqual(dto.roles, ['EMPLOYEE']);
  assert.equal(dto.role, undefined);
  assert.deepEqual(toUserDto({ _id: 'u3', status: 'active' }).roles, []);
  assert.equal(toUserDto({ _id: 'u2', status: 'active' }).isActive, true);
});

/**
 * Unit test: listUsers returns DTOs.
 */
test('listUsers returns array of user DTOs', async () => {
  const usersRepository = createUsersRepository(
    storedUser({ email: 'list@laprizza.pt', roles: ['CUSTOMER'] }),
  );
  const users = await listUsers(usersRepository);
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'list@laprizza.pt');
  assert.equal(users[0].passwordHash, undefined);
  assert.equal(usersRepository.listUsers.mock.callCount(), 1);
});

/**
 * Unit test: getUserById returns the user or 404.
 */
test('getUserById returns user or throws 404', async () => {
  const usersRepository = createUsersRepository(storedUser({ email: 'target@laprizza.pt' }));
  assert.equal((await getUserById(USER_ID, usersRepository)).email, 'target@laprizza.pt');
  await assert.rejects(getUserById('fake_id', usersRepository), (err) => err.status === 404);
});

/**
 * Unit test: isActive=false disables the account and invalidates its sessions (tokenVersion).
 */
test('updateUser maps isActive to status and revokes sessions when disabling', async () => {
  const usersRepository = createUsersRepository();

  const disabled = await updateUser(USER_ID, { isActive: false }, usersRepository);
  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.isActive, false);
  assert.deepEqual(savedPatch(usersRepository, 0), { status: 'disabled', tokenVersion: 1 });

  // Next step: the stored user is now disabled with tokenVersion 1.
  usersRepository.findById.mock.mockImplementation(async () =>
    storedUser({ status: 'disabled', tokenVersion: 1 }),
  );
  const reactivated = await updateUser(USER_ID, { isActive: true }, usersRepository);
  assert.equal(reactivated.status, 'active');
  assert.deepEqual(savedPatch(usersRepository, 1), { status: 'active' }); // reactivating does not revoke
});

/**
 * Unit test: password change by the Manager hashes the new one, resets the counters and revokes sessions.
 */
test('updateUser hashes a new password, resets lockout and revokes sessions', async () => {
  const usersRepository = createUsersRepository(
    storedUser({ failedLoginCount: 4, lockedUntil: new Date() }),
  );

  await updateUser(USER_ID, { password: 'NewStrongPassword123!' }, usersRepository);

  const patch = savedPatch(usersRepository);
  assert.equal(await argon2.verify(patch.passwordHash, 'NewStrongPassword123!'), true);
  assert.equal(await argon2.verify(patch.passwordHash, PASSWORD), false);
  assert.equal(patch.failedLoginCount, 0);
  assert.equal(patch.lockedUntil, null);
  assert.equal(patch.tokenVersion, 1);
});

const MANAGER_ACTOR = {
  userId: 'abcdef000000000000000099',
  permissions: permissionsFor(['MANAGER']),
};
const EMPLOYEE_ASSIGNER = {
  userId: 'abcdef000000000000000098',
  permissions: ['users:read', 'roles:assign:employee'],
};

const rejectsWithCode = (promise, status, code) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });

/**
 * Unit test (AA05): roles no longer change through updateUser.
 */
test('updateUser ignores role fields', async () => {
  const usersRepository = createUsersRepository();
  await updateUser(
    USER_ID,
    { role: 'MANAGER', roles: ['MANAGER'], isActive: true },
    usersRepository,
  );
  assert.deepEqual(savedPatch(usersRepository), { status: 'active' });
});

/**
 * Unit test (AA05): an actor adds a role it may assign; sessions are not revoked
 * (roles are read from the database on every request).
 */
test('addRole adds an assignable role without revoking sessions', async () => {
  const usersRepository = createUsersRepository(storedUser({ roles: [] }));

  const updated = await addRole(EMPLOYEE_ASSIGNER, USER_ID, 'EMPLOYEE', usersRepository);

  assert.deepEqual(updated.roles, ['EMPLOYEE']);
  assert.deepEqual(usersRepository.addRole.mock.calls[0].arguments, [USER_ID, 'EMPLOYEE']);
  assert.equal(usersRepository.update.mock.callCount(), 0);
});

test('addRole refuses roles the actor cannot assign', async () => {
  const usersRepository = createUsersRepository(storedUser({ roles: ['EMPLOYEE'] }));

  await assert.rejects(addRole(EMPLOYEE_ASSIGNER, USER_ID, 'MANAGER', usersRepository), (err) => {
    assert.equal(err.status, 403);
    assert.equal(err.code, 'ROLE_NOT_ASSIGNABLE');
    assert.deepEqual(err.details, { roles: ['MANAGER'] });
    return true;
  });
  assert.equal(usersRepository.addRole.mock.callCount(), 0);
});

test('nobody adds or removes their own roles', async () => {
  const usersRepository = createUsersRepository(storedUser({ roles: ['MANAGER'] }));
  const self = { ...MANAGER_ACTOR, userId: USER_ID };

  await rejectsWithCode(
    addRole(self, USER_ID, 'EMPLOYEE', usersRepository),
    403,
    'SELF_ROLE_CHANGE',
  );
  await rejectsWithCode(
    removeRole(self, USER_ID, 'MANAGER', usersRepository),
    403,
    'SELF_ROLE_CHANGE',
  );
  assert.equal(usersRepository.addRole.mock.callCount(), 0);
  assert.equal(usersRepository.removeRole.mock.callCount(), 0);
});

test('removeRole of CUSTOMER also clears customerId', async () => {
  const usersRepository = createUsersRepository(
    storedUser({ roles: ['CUSTOMER'], customerId: '65231abcd345678901234567' }),
  );

  const updated = await removeRole(MANAGER_ACTOR, USER_ID, 'CUSTOMER', usersRepository);

  assert.deepEqual(updated.roles, []);
  assert.equal(updated.customerId, null);
  assert.deepEqual(usersRepository.removeRole.mock.calls[0].arguments, [
    USER_ID,
    'CUSTOMER',
    { clearCustomerId: true },
  ]);
});

test('removeRole of another role keeps customerId', async () => {
  const usersRepository = createUsersRepository(
    storedUser({ roles: ['CUSTOMER', 'EMPLOYEE'], customerId: '65231abcd345678901234567' }),
  );

  await removeRole(EMPLOYEE_ASSIGNER, USER_ID, 'EMPLOYEE', usersRepository);

  assert.deepEqual(usersRepository.removeRole.mock.calls[0].arguments[2], {
    clearCustomerId: false,
  });
});

test('addRole and removeRole return 404 for unknown users', async () => {
  const usersRepository = createUsersRepository();
  const unknown = 'abcdef000000000000000999';

  await assert.rejects(
    addRole(MANAGER_ACTOR, unknown, 'EMPLOYEE', usersRepository),
    (e) => e.status === 404,
  );
  await assert.rejects(
    removeRole(MANAGER_ACTOR, unknown, 'EMPLOYEE', usersRepository),
    (e) => e.status === 404,
  );
});

/**
 * Unit test: the policy also applies to changes made by the Manager.
 */
test('updateUser rejects weak passwords', async () => {
  const usersRepository = createUsersRepository();
  await assert.rejects(updateUser(USER_ID, { password: '123' }, usersRepository), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, AuthErrorCode.PASSWORD_POLICY_VIOLATION);
    return true;
  });
  assert.equal(usersRepository.update.mock.callCount(), 0);
});

/**
 * Unit test: non-existent user -> 404.
 */
test('updateUser throws 404 for unknown users', async () => {
  const usersRepository = { findById: mock.fn(async () => undefined), update: mock.fn() };
  await assert.rejects(
    updateUser('abcdef000000000000000999', { isActive: false }, usersRepository),
    (err) => err.status === 404,
  );
  assert.equal(usersRepository.update.mock.callCount(), 0);
});
