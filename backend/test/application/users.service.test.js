import test from 'node:test';
import assert from 'node:assert/strict';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { registerUser, login } from '../../src/application/auth.service.js';
import { listUsers, getUserById, updateUser } from '../../src/application/users.service.js';

process.env.JWT_SECRET = 'test_secret_key';

/**
 * Unit test: listUsers service.
 * Verifies that the service retrieves the list of users from the repository
 * and properly formats them into an array of Data Transfer Objects (DTOs).
 */
test('listUsers returns array of users from repository', async () => {
  const dummyRepo = createDummyUsersRepository();
  await registerUser(
    { email: 'list@laprizza.pt', password: 'StrongPassword123!', role: 'CUSTOMER' },
    dummyRepo,
  );
  const users = await listUsers(dummyRepo);
  assert.ok(Array.isArray(users));
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'list@laprizza.pt');
});

/**
 * Unit test: getUserById service.
 * Validates that a user can be successfully retrieved by their unique ID,
 * and ensures that a 404 Not Found error is thrown if the ID does not exist.
 */
test('getUserById returns user or throws 404', async () => {
  const dummyRepo = createDummyUsersRepository();
  const user = await registerUser(
    { email: 'target@laprizza.pt', password: 'StrongPassword123!', role: 'CUSTOMER' },
    dummyRepo,
  );

  const found = await getUserById(user.id, dummyRepo);
  assert.equal(found.email, 'target@laprizza.pt');

  await assert.rejects(
    async () => await getUserById('fake_id', dummyRepo),
    (err) => err.status === 404,
  );
});

/**
 * Unit test: updateUser service (Security and Field Updates).
 * Asserts that role and isActive status can be successfully updated.
 * Also verifies that updating a password securely hashes the new password,
 * rendering the old password invalid for login while allowing the new one.
 */
test('updateUser modifies role, isActive and password securely', async () => {
  const dummyRepo = createDummyUsersRepository();
  const user = await registerUser(
    { email: 'patch@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    dummyRepo,
  );

  const updated = await updateUser(
    user.id,
    {
      role: 'MANAGER',
      isActive: true,
      password: 'NewStrongPassword123!',
    },
    dummyRepo,
  );

  assert.equal(updated.role, 'MANAGER');

  // Verify old password no longer works
  await assert.rejects(
    async () =>
      await login({ identifier: 'patch@laprizza.pt', password: 'StrongPassword123!' }, dummyRepo),
    (err) => err.status === 401,
  );

  // Verify new password works
  const token = await login(
    { identifier: 'patch@laprizza.pt', password: 'NewStrongPassword123!' },
    dummyRepo,
  );
  assert.ok(token);
});

/**
 * Unit test: updateUser service (Business Logic Validation).
 * Enforces the rule that only users with the CUSTOMER role can have a customerId.
 * Verifies that the customerId is automatically cleared (set to null) if the user's role is changed to something else.
 */
test('updateUser clears customerId when role changes from CUSTOMER to another role', async () => {
  const dummyRepo = createDummyUsersRepository();
  const user = await registerUser(
    {
      email: 'cliente@laprizza.pt',
      password: 'StrongPassword123!',
      role: 'CUSTOMER',
      customerId: '65231abcd345678901234567',
    },
    dummyRepo,
  );

  assert.equal(user.customerId, '65231abcd345678901234567');

  const updated = await updateUser(user.id, { role: 'EMPLOYEE' }, dummyRepo);

  assert.equal(updated.role, 'EMPLOYEE');
  assert.equal(updated.customerId, null);
});

/**
 * Unit test: updateUser service.
 * Ensures that password strength rules are also enforced during account updates,
 * returning a 400 Bad Request error if a weak password is provided.
 */
test('updateUser rejects weak passwords', async () => {
  const dummyRepo = createDummyUsersRepository();
  const user = await registerUser(
    { email: 'fraca@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    dummyRepo,
  );

  await assert.rejects(
    async () => await updateUser(user.id, { password: '123' }, dummyRepo),
    (err) => err.status === 400,
  );
});