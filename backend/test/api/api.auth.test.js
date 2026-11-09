import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
// Same hasher the API uses by default to verify passwords at login.
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const ADMIN_ID = 'abcdef000000000000000001';
const TARGET_ID = 'abcdef000000000000000003';

/** User document as returned by the users repository. */
const storedUser = (data) => ({
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
  ...data,
});

const SEEDED_USERS = [
  storedUser({ _id: ADMIN_ID, email: 'admin@laprizza.pt', role: 'MANAGER' }),
  storedUser({ _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', role: 'EMPLOYEE' }),
];

/**
 * Programs the mocked users repository (and the sessions it relies on) with the stored users.
 * The repository answers as the real one would for that data; tests call it again when a step
 * changes the stored users.
 */
function storeUsers({ usersRepository, sessionsRepository }, users) {
  const byId = (id) => users.find((u) => u._id === String(id)) ?? null;
  usersRepository.findById.mock.mockImplementation(async (id) => byId(id));
  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(
    async (email) => users.find((u) => u.email === email) ?? null,
  );
  usersRepository.listUsers.mock.mockImplementation(async () => users);
  usersRepository.update.mock.mockImplementation(async (id, data) =>
    byId(id) ? { ...byId(id), ...data } : null,
  );
  usersRepository.registerFailedLogin.mock.mockImplementation(async (id) => ({
    ...byId(id),
    failedLoginCount: byId(id).failedLoginCount + 1,
  }));
  // One always-active session per user (session id = user id).
  sessionsRepository.findById.mock.mockImplementation(async (id) =>
    byId(id)
      ? { _id: id, userId: id, tokenVersion: 0, expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null }
      : null,
  );
}

/**
 * Initializes the test server with mocked repositories.
 * Seeds initial MANAGER and EMPLOYEE accounts for testing to avoid touching the real database.
 *
 * @returns {Promise<{server: import('node:http').Server, port: number}>} An object containing the running server instance and its allocated port.
 */
async function setupTestServer() {
  const mocks = {
    usersRepository: {
      findById: mock.fn(),
      findByEmailWithPasswordHash: mock.fn(),
      listUsers: mock.fn(),
      create: mock.fn(async (data) => ({ _id: TARGET_ID, ...data })),
      update: mock.fn(),
      registerFailedLogin: mock.fn(),
      extendLockout: mock.fn(async () => {}),
      clearLoginFailures: mock.fn(async () => {}),
    },
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(),
    },
    securityLogger: { log: mock.fn() },
  };
  storeUsers(mocks, SEEDED_USERS);

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), mocks).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  return { server, port, ...mocks };
}

/**
 * Integration tests for the authentication login flow.
 * Validates missing fields, invalid credentials, and successful token generation.
 */
test('API POST /auth/login (400, 401, 200)', async (t) => {
  const { server, port, usersRepository, sessionsRepository } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  let res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt' }),
  });
  assert.equal(res.status, 400);
  assert.equal(usersRepository.findByEmailWithPasswordHash.mock.callCount(), 0);

  res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'Wrong!' }),
  });
  assert.equal(res.status, 401);
  assert.deepEqual(usersRepository.registerFailedLogin.mock.calls[0].arguments, [ADMIN_ID]);

  res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).accessToken);
  assert.equal(sessionsRepository.create.mock.callCount(), 1);
});

/**
 * Integration tests for user creation and listing.
 * Validates Role-Based Access Control (RBAC), unique email constraints, and DTO password omission.
 */
test('API GET and POST /users (Roles and validations)', async (t) => {
  const { server, port, usersRepository } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).accessToken;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).accessToken;

  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/users`)).status, 401);

  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        headers: { Authorization: `Bearer ${empToken}` },
      })
    ).status,
    403,
  );

  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    200,
  );

  // 400 Bad Request (Missing role)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@p.pt', password: 'StrongPassword123!' }),
      })
    ).status,
    400,
  );

  // 403 Forbidden (EMPLOYEE trying to create a user)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hacker@laprizza.pt',
          password: 'StrongPassword123!',
          role: 'CUSTOMER',
        }),
      })
    ).status,
    403,
  );

  assert.equal(usersRepository.create.mock.callCount(), 0);

  // 409 Conflict (Duplicate email): the unique index rejects it
  usersRepository.create.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000 });
  });
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'emp@laprizza.pt',
          password: 'StrongPassword123!',
          role: 'CUSTOMER',
        }),
      })
    ).status,
    409,
  );

  // 201 Created (Valid payload) - Validates if the DTO omits the password
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new@laprizza.pt',
      password: 'StrongPassword123!',
      role: 'CUSTOMER',
    }),
  });
  assert.equal(postRes.status, 201);
  const postBody = await postRes.json();
  assert.equal(postBody.password, undefined);
  assert.equal(postBody.passwordHash, undefined);
  const saved = usersRepository.create.mock.calls.at(-1).arguments[0];
  assert.equal(saved.email, 'new@laprizza.pt');
  assert.equal(saved.password, undefined); // only the hash reaches the repository
  assert.match(saved.passwordHash, /^\$argon2id\$/);

  // 200 OK GET - Validates if the DTO omits the password in the list
  const listRes = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listBody[0].password, undefined);
  assert.equal(listBody[0].passwordHash, undefined);
});

/**
 * Integration tests for querying and updating specific users by ID.
 * Validates parameter formats, account deactivation, and Manager self-protection rules.
 */
test('API GET and PATCH /users/:id (Consult and Update)', async (t) => {
  const { server, port, usersRepository, sessionsRepository } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).accessToken;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).accessToken;

  const createRes = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alvo@laprizza.pt',
      password: 'StrongPassword123!',
      role: 'CUSTOMER',
    }),
  });
  const targetUser = await createRes.json();
  const targetId = targetUser.id;

  // Step: the new user is stored.
  const target = await usersRepository.create.mock.calls[0].result;
  storeUsers({ usersRepository, sessionsRepository }, [...SEEDED_USERS, target]);

  // 400 Bad Request - Invalid ID format
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/id_invalido_curto`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    400,
  );

  // 404 Not Found - GET with valid format but non-existent ID
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/abcdef000000000000000999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    404,
  );

  // 404 Not Found - PATCH with valid format but non-existent ID
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/abcdef000000000000000999`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    404,
  );

  // GET /users/:id (200 OK) - Validates if the DTO omits the password
  const get200 = await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(get200.status, 200);
  assert.equal((await get200.json()).password, undefined);

  // 401 & 403 - General protections
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`)).status, 401);
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`, {
        headers: { Authorization: `Bearer ${empToken}` },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    403,
  );

  // PATCH /users/:id (200 - Disable account)
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false, role: 'EMPLOYEE' }),
  });

  assert.equal(patchRes.status, 200);
  const patchBody = await patchRes.json();
  assert.equal(patchBody.isActive, false);
  assert.equal(patchBody.role, 'EMPLOYEE');
  assert.equal(patchBody.password, undefined);
  const [updatedId, patch] = usersRepository.update.mock.calls[0].arguments;
  assert.equal(updatedId, targetId);
  assert.equal(patch.status, 'disabled');
  assert.equal(patch.tokenVersion, 1); // disabling revokes the sessions

  // Step: the target account is now disabled.
  storeUsers({ usersRepository, sessionsRepository }, [
    ...SEEDED_USERS,
    { ...target, ...patch, role: 'EMPLOYEE' },
  ]);

  // 403 Forbidden - Login blocked for disabled account (AA01: correct password + disabled account -> ACCOUNT_DISABLED)
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alvo@laprizza.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(loginRes.status, 403);
  assert.equal((await loginRes.json()).error.code, 'ACCOUNT_DISABLED');

  // 400 Bad Request - Empty PATCH (Joi validation)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${targetId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).status,
    400,
  );

  // The access token carries the user id in the standard 'sub' claim (AA01).
  const decodedAdmin = jwt.decode(adminToken);
  const adminId = decodedAdmin.sub;

  // 403 Forbidden - Manager attempts to disable themselves
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${adminId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    403,
  );

  // 403 Forbidden - toUpperCase() protection in action
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${adminId.toUpperCase()}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    403,
  );
  assert.equal(usersRepository.update.mock.callCount(), 1); // the manager was never disabled

  // 200 OK - Manager can change their own password
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/users/${adminId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'AnotherStrongPassword123!' }),
      })
    ).status,
    200,
  );
  const [ownId, ownPatch] = usersRepository.update.mock.calls.at(-1).arguments;
  assert.equal(ownId, adminId);
  assert.equal(await passwordHasher.verify(ownPatch.passwordHash, 'AnotherStrongPassword123!'), true);
});