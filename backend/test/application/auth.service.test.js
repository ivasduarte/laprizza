import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { registerUser, login } from '../../src/application/auth.service.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';

process.env.JWT_SECRET = 'false_secret';

/**
 * Unit test: registerUser service.
 * Ensures that the registration process is aborted and throws a 400 Bad Request error
 * if a weak password is provided, preventing any interaction with the database.
 */
test('registerUser rejects weak passwords without saving to the database', async () => {
  // Setup: create an empty dummy repository
  const dummyRepo = createDummyUsersRepository();

  // Action & Assert: try creating an account with the password "123" and guarantee it fails with status code 400
  await assert.rejects(
    async () => {
      await registerUser(
        {
          email: 'teste@laprizza.pt',
          password: '123',
          role: 'EMPLOYEE',
        },
        dummyRepo,
      ); // Inject Dummy Repository
    },
    (err) => err.status === 400, // Confirms application error is 400
  );

  // Verify that the repository remains empty (the database was not touched)
  assert.equal(dummyRepo._getUsers().length, 0);
});

/**
 * Unit test: registerUser service.
 * Ensures that a user is successfully created when providing a strong password.
 * Validates that the returned DTO maps the identifier to '.id' and that the password is hashed.
 */
test('registerUser created successfully if the password is strong', async () => {
  const dummyRepo = createDummyUsersRepository();
  const newUser = await registerUser(
    {
      email: 'joao@laprizza.pt',
      password: 'StrongPassword123!',
      role: 'EMPLOYEE',
    },
    dummyRepo,
  );

  // Assert DTO uses .id instead of ._id
  assert.ok(newUser.id);
  assert.equal(dummyRepo._getUsers().length, 1);

  // Assert password was hashed before saving to the database
  const dbUser = dummyRepo._getUsers()[0];
  assert.notEqual(dbUser.password, 'StrongPassword123!');
});

/**
 * Unit test: login service.
 * Verifies that providing incorrect credentials (wrong password) triggers a 401 Unauthorized error.
 */
test('login rejects incorrect credentials', async () => {
  const dummyRepo = createDummyUsersRepository();

  // Setup: create user
  await registerUser(
    {
      email: 'joao@laprizza.pt',
      password: 'StrongPassword123!',
      role: 'EMPLOYEE',
    },
    dummyRepo,
  );

  // Attempt to login with the wrong password and expect a 401 error
  await assert.rejects(
    async () => {
      await login(
        {
          identifier: 'joao@laprizza.pt',
          password: 'WrongPassword999?',
        },
        dummyRepo,
      );
    },
    (err) => err.status === 401,
  );
});

/**
 * Unit test: registerUser service (Business Logic Validation).
 * Prevents assigning a customerId to user accounts that do not possess the CUSTOMER role.
 */
test('registerUser fails if customerId is provided but role is not CUSTOMER', async () => {
  const dummyRepo = createDummyUsersRepository();
  await assert.rejects(
    async () =>
      await registerUser(
        { email: 'x@x.pt', password: 'StrongPassword123!', role: 'EMPLOYEE', customerId: 'fakeid' },
        dummyRepo,
      ),
    (err) => err.status === 400,
  );
});

/**
 * Unit test: login service (Security).
 * Validates timing attack mitigation. Ensures the login function executes a dummy hash calculation
 * when an account does not exist, keeping execution times roughly equivalent to a legitimate failed attempt.
 */
test('login delays execution (timing attack mitigation) if user does not exist', async () => {
  const dummyRepo = createDummyUsersRepository();
  await registerUser(
    { email: 'real@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    dummyRepo,
  );

  const startReal = Date.now();
  await assert.rejects(
    async () =>
      await login({ identifier: 'real@laprizza.pt', password: 'WrongPassword1!' }, dummyRepo),
  );
  const durationReal = Date.now() - startReal;

  const startFake = Date.now();
  await assert.rejects(
    async () =>
      await login({ identifier: 'ghost@laprizza.pt', password: 'StrongPassword123!' }, dummyRepo),
  );
  const durationFake = Date.now() - startFake;

  // Asserts the processing time for a non-existent user is similar to a wrong password attempt
  assert.ok(durationFake >= durationReal * 0.1 && durationFake <= durationReal * 5.0);
});

/**
 * Unit test: registerUser service.
 * Simulates a database duplicate key error (11000) and asserts it translates into a 409 Conflict.
 */
test('registerUser returns 409 Conflict on duplicate email or username', async () => {
  const dummyRepo = createDummyUsersRepository();
  await registerUser(
    { email: 'duplicado@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    dummyRepo,
  );
  await assert.rejects(
    async () =>
      await registerUser(
        { email: 'duplicado@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
        dummyRepo,
      ),
    (err) => err.status === 409,
  );
});

/**
 * Unit test: login service.
 * Ensures the login identifier is case-insensitive, allowing uppercase inputs to match lowercase database records.
 */
test('login accepts valid username and handles uppercase identifiers', async () => {
  const dummyRepo = createDummyUsersRepository();
  await registerUser(
    { username: 'adminuser', password: 'StrongPassword123!', role: 'MANAGER' },
    dummyRepo,
  );

  const token = await login({ identifier: 'AdminUser', password: 'StrongPassword123!' }, dummyRepo);
  assert.ok(token);
});

/**
 * Unit test: login service.
 * Verifies that a successful authentication returns a valid JWT containing the correct userId, role, and a 35-minute expiration span (2100 seconds).
 */
test('successful login returns a valid JWT token', async () => {
  const dummyRepo = createDummyUsersRepository();
  const user = await registerUser(
    { email: 'jwt@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    dummyRepo,
  );
  const token = await login(
    { identifier: 'jwt@laprizza.pt', password: 'StrongPassword123!' },
    dummyRepo,
  );

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.userId, user.id);
  assert.equal(decoded.role, 'MANAGER');
  // Asserts the token validity lifespan is exactly 35 minutes (2100 seconds)
  assert.equal(decoded.exp - decoded.iat, 2100);
});