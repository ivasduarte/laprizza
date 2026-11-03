import test from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createPasswordHasher } from '../../src/infrastructure/security/password-hasher.js';
import { registerUser } from '../../src/application/auth/auth.service.js';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import { listUsers, getUserById, updateUser, toUserDto } from '../../src/application/users/users.service.js';
import { FAST_ARGON2_OPTIONS } from '../infrastructure/auth.dummy.dependencies.js';

const PASSWORD = 'StrongPassword123!';
const fastHasher = createPasswordHasher(FAST_ARGON2_OPTIONS);

/** Creates a repository with one user and returns both. */
async function withUser(data = {}) {
  const usersRepository = createDummyUsersRepository();
  const user = await registerUser(
    { email: 'user@laprizza.pt', password: PASSWORD, role: 'EMPLOYEE', ...data },
    usersRepository,
    fastHasher,
  );
  return { usersRepository, user };
}

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
  const { usersRepository } = await withUser({ email: 'list@laprizza.pt', role: 'CUSTOMER' });
  const users = await listUsers(usersRepository);
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'list@laprizza.pt');
  assert.equal(users[0].passwordHash, undefined);
});

/**
 * Unit test: getUserById returns the user or 404.
 */
test('getUserById returns user or throws 404', async () => {
  const { usersRepository, user } = await withUser({ email: 'target@laprizza.pt' });
  assert.equal((await getUserById(user.id, usersRepository)).email, 'target@laprizza.pt');
  await assert.rejects(getUserById('fake_id', usersRepository), (err) => err.status === 404);
});

/**
 * Unit test: isActive=false disables the account and invalidates its sessions (tokenVersion).
 */
test('updateUser maps isActive to status and revokes sessions when disabling', async () => {
  const { usersRepository, user } = await withUser();

  const disabled = await updateUser(user.id, { isActive: false }, usersRepository);
  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.isActive, false);
  assert.equal((await usersRepository.findById(user.id)).tokenVersion, 1);

  const reactivated = await updateUser(user.id, { isActive: true }, usersRepository);
  assert.equal(reactivated.status, 'active');
  assert.equal((await usersRepository.findById(user.id)).tokenVersion, 1); // reactivating does not revoke
});

/**
 * Unit test: password change by the Manager hashes the new one, resets the counters and revokes sessions.
 */
test('updateUser hashes a new password, resets lockout and revokes sessions', async () => {
  const { usersRepository, user } = await withUser();
  await usersRepository.update(user.id, { failedLoginCount: 4, lockedUntil: new Date() });

  await updateUser(user.id, { password: 'NewStrongPassword123!' }, usersRepository);

  const stored = await usersRepository.findById(user.id);
  assert.equal(await argon2.verify(stored.passwordHash, 'NewStrongPassword123!'), true);
  assert.equal(await argon2.verify(stored.passwordHash, PASSWORD), false);
  assert.equal(stored.failedLoginCount, 0);
  assert.equal(stored.lockedUntil, null);
  assert.equal(stored.tokenVersion, 1);
});

/**
 * Unit test: a role change does not revoke sessions (the role is read from the database on each request).
 */
test('updateUser changes the role without revoking sessions', async () => {
  const { usersRepository, user } = await withUser();
  const updated = await updateUser(user.id, { role: 'MANAGER' }, usersRepository);
  assert.equal(updated.role, 'MANAGER');
  assert.equal((await usersRepository.findById(user.id)).tokenVersion, 0);
});

/**
 * Unit test: customerId is cleared when the role stops being CUSTOMER.
 */
test('updateUser clears customerId when role changes from CUSTOMER to another role', async () => {
  const { usersRepository, user } = await withUser({
    email: 'cliente@laprizza.pt',
    role: 'CUSTOMER',
    customerId: '65231abcd345678901234567',
  });
  assert.equal(user.customerId, '65231abcd345678901234567');

  const updated = await updateUser(user.id, { role: 'EMPLOYEE' }, usersRepository);
  assert.equal(updated.customerId, null);
});

/**
 * Unit test: the policy also applies to changes made by the Manager.
 */
test('updateUser rejects weak passwords', async () => {
  const { usersRepository, user } = await withUser();
  await assert.rejects(updateUser(user.id, { password: '123' }, usersRepository), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, AuthErrorCode.PASSWORD_POLICY_VIOLATION);
    return true;
  });
});

/**
 * Unit test: non-existent user -> 404.
 */
test('updateUser throws 404 for unknown users', async () => {
  await assert.rejects(
    updateUser('abcdef000000000000000999', { role: 'MANAGER' }, createDummyUsersRepository()),
    (err) => err.status === 404,
  );
});
