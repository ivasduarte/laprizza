import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import { listUsers, getUserById, updateUser, toUserDto } from '../../src/application/users/users.service.js';

const PASSWORD = 'StrongPassword123!';
const USER_ID = 'abcdef000000000000000001';

/** Stored user document (as returned by the real repository). */
const storedUser = (data = {}) => ({
  _id: USER_ID,
  email: 'user@laprizza.pt',
  role: 'EMPLOYEE',
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
    role: 'EMPLOYEE',
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
  assert.equal(toUserDto({ _id: 'u2', status: 'active' }).isActive, true);
});

/**
 * Unit test: listUsers returns DTOs.
 */
test('listUsers returns array of user DTOs', async () => {
  const usersRepository = createUsersRepository(
    storedUser({ email: 'list@laprizza.pt', role: 'CUSTOMER' }),
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

/**
 * Unit test: a role change does not revoke sessions (the role is read from the database on each request).
 */
test('updateUser changes the role without revoking sessions', async () => {
  const usersRepository = createUsersRepository();
  const updated = await updateUser(USER_ID, { role: 'MANAGER' }, usersRepository);
  assert.equal(updated.role, 'MANAGER');
  assert.equal(savedPatch(usersRepository).tokenVersion, undefined);
});

/**
 * Unit test: customerId is cleared when the role stops being CUSTOMER.
 */
test('updateUser clears customerId when role changes from CUSTOMER to another role', async () => {
  const usersRepository = createUsersRepository(
    storedUser({
      email: 'cliente@laprizza.pt',
      role: 'CUSTOMER',
      customerId: '65231abcd345678901234567',
    }),
  );

  const updated = await updateUser(USER_ID, { role: 'EMPLOYEE' }, usersRepository);
  assert.equal(updated.customerId, null);
  assert.deepEqual(savedPatch(usersRepository), { role: 'EMPLOYEE', customerId: null });
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
    updateUser('abcdef000000000000000999', { role: 'MANAGER' }, usersRepository),
    (err) => err.status === 404,
  );
  assert.equal(usersRepository.update.mock.callCount(), 0);
});
