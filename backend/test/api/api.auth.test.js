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

const MANAGER_ID = 'abcdef000000000000000004';
const SEEDED_USERS = [
  storedUser({ _id: ADMIN_ID, email: 'admin@laprizza.pt', roles: ['ADMINISTRATOR', 'MANAGER'] }),
  storedUser({ _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', roles: ['EMPLOYEE'] }),
  storedUser({ _id: MANAGER_ID, email: 'mgr@laprizza.pt', roles: ['MANAGER'] }),
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
  // Conditional updates, as in MongoDB: null when nothing changed.
  usersRepository.addRoleIfAbsent.mock.mockImplementation(async (id, role) =>
    byId(id) && !byId(id).roles.includes(role)
      ? { ...byId(id), roles: [...byId(id).roles, role] }
      : null,
  );
  usersRepository.removeRoleIfPresent.mock.mockImplementation(async (id, role) =>
    byId(id)?.roles.includes(role)
      ? { ...byId(id), roles: byId(id).roles.filter((r) => r !== role) }
      : null,
  );
  usersRepository.registerFailedLogin.mock.mockImplementation(async (id) => ({
    ...byId(id),
    failedLoginCount: byId(id).failedLoginCount + 1,
  }));
  // One always-active session per user (session id = user id).
  sessionsRepository.findById.mock.mockImplementation(async (id) =>
    byId(id)
      ? {
          _id: id,
          userId: id,
          tokenVersion: 0,
          expiresAt: new Date(Date.now() + 3_600_000),
          revokedAt: null,
        }
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
      deleteById: mock.fn(async () => ({ deletedCount: 1 })),
      registerFailedLogin: mock.fn(),
      extendLockout: mock.fn(async () => {}),
      clearLoginFailures: mock.fn(async () => {}),
      addRoleIfAbsent: mock.fn(),
      removeRoleIfPresent: mock.fn(),
    },
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(),
    },
    // AA06
    invitationsRepository: {
      create: mock.fn(async (data) => data),
      revokePendingForUser: mock.fn(async () => ({})),
    },
    roleChangesRepository: {
      insertMany: mock.fn(async (changes) => changes),
      listForUser: mock.fn(async () => []),
    },
    emailService: { send: mock.fn(async () => {}) },
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

  let res = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt' }),
  });
  assert.equal(res.status, 400);
  assert.equal(usersRepository.findByEmailWithPasswordHash.mock.callCount(), 0);

  res = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'Wrong!' }),
  });
  assert.equal(res.status, 401);
  assert.deepEqual(usersRepository.registerFailedLogin.mock.calls[0].arguments, [ADMIN_ID]);

  res = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
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
  const { server, port, usersRepository, emailService, roleChangesRepository } =
    await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).accessToken;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).accessToken;

  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v2/users`)).status, 401);

  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
        headers: { Authorization: `Bearer ${empToken}` },
      })
    ).status,
    403,
  );

  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    200,
  );

  // 400 Bad Request (Unknown role)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@p.pt', roles: ['ROOT'] }),
      })
    ).status,
    400,
  );

  // 400 Bad Request (AA06: the Administrator never sets the password of a new account)
  const withPassword = await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'new@p.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(withPassword.status, 400);
  assert.match(JSON.stringify(await withPassword.json()), /activation invitation/);

  // 403 Forbidden (EMPLOYEE and MANAGER trying to create a user: AA06, Administrator only)
  const mgrToken = (
    await (
      await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mgr@laprizza.pt', password: PASSWORD }),
      })
    ).json()
  ).accessToken;
  for (const token of [empToken, mgrToken]) {
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'hacker@laprizza.pt', roles: ['CUSTOMER'] }),
        })
      ).status,
      403,
    );
  }

  assert.equal(usersRepository.create.mock.callCount(), 0);

  // 409 Conflict (Duplicate email): the unique index rejects it
  usersRepository.create.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000 });
  });
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'emp@laprizza.pt', roles: ['CUSTOMER'] }),
      })
    ).status,
    409,
  );

  // 201 Created (AA06): inactive account, no password, invitation sent to the intended address
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'new@laprizza.pt', roles: ['EMPLOYEE'] }),
  });
  assert.equal(postRes.status, 201);
  const postBody = await postRes.json();
  assert.equal(postBody.passwordHash, undefined);
  assert.equal(postBody.status, 'inactive');
  assert.equal(postBody.pendingActivation, true);
  assert.equal(postBody.invitation.sent, true);
  const saved = usersRepository.create.mock.calls.at(-1).arguments[0];
  assert.equal(saved.email, 'new@laprizza.pt');
  assert.equal(saved.passwordHash, undefined);
  assert.equal(saved.status, 'inactive');
  assert.deepEqual(saved.roles, ['CUSTOMER', 'EMPLOYEE']);
  assert.deepEqual(postBody.roles, ['CUSTOMER', 'EMPLOYEE']);

  const email = emailService.send.mock.calls.at(-1).arguments[0];
  assert.equal(email.to, 'new@laprizza.pt');
  assert.match(email.text, /\/activate#token=[A-Za-z0-9_-]{43}/);
  assert.equal(JSON.stringify(postBody).includes('token'), false);

  // The roles are recorded with the responsible actor (AA06)
  const recorded = roleChangesRepository.insertMany.mock.calls.at(-1).arguments[0];
  assert.deepEqual(
    recorded.map(({ role, actor }) => [role, actor.kind, actor.userId ?? actor.process]),
    [
      ['CUSTOMER', 'SYSTEM', 'initial-customer-role'],
      ['EMPLOYEE', 'USER', ADMIN_ID],
    ],
  );

  // 201 Created - no roles requested: the back end still assigns Customer (AA03)
  const noRoles = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'noroles@laprizza.pt' }),
  });
  assert.equal(noRoles.status, 201);
  assert.deepEqual(usersRepository.create.mock.calls.at(-1).arguments[0].roles, ['CUSTOMER']);

  // 200 OK GET - Validates if the DTO omits the password in the list
  const listRes = await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
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

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).accessToken;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).accessToken;

  const createRes = await fetch(`http://127.0.0.1:${port}/api/v2/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alvo@laprizza.pt', roles: ['CUSTOMER'] }),
  });
  const targetUser = await createRes.json();
  const targetId = targetUser.id;

  // Step: the new (inactive, never activated) user is stored.
  const pending = await usersRepository.create.mock.calls[0].result;
  storeUsers({ usersRepository, sessionsRepository }, [...SEEDED_USERS, pending]);

  // 409 (AA06): an Administrator cannot enable an account that was never activated
  const enablePending = await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true }),
  });
  assert.equal(enablePending.status, 409);
  assert.equal((await enablePending.json()).error.code, 'ACTIVATION_REQUIRED');
  assert.equal(usersRepository.update.mock.callCount(), 0);

  // Step: the user activated the account (AA07) and has a password.
  const target = {
    ...pending,
    status: 'active',
    activatedAt: new Date(),
    passwordHash: PASSWORD_HASH,
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
  };
  storeUsers({ usersRepository, sessionsRepository }, [...SEEDED_USERS, target]);

  // 400 Bad Request - Invalid ID format
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/id_invalido_curto`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    400,
  );

  // 404 Not Found - GET with valid format but non-existent ID
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/abcdef000000000000000999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    404,
  );

  // 404 Not Found - PATCH with valid format but non-existent ID
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/abcdef000000000000000999`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    404,
  );

  // GET /users/:id (200 OK) - Validates if the DTO omits the password
  const get200 = await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(get200.status, 200);
  assert.equal((await get200.json()).password, undefined);

  // 401 & 403 - General protections
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`)).status, 401);
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
        headers: { Authorization: `Bearer ${empToken}` },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    ).status,
    403,
  );

  // PATCH /users/:id (200 - Disable account)
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false, roles: ['EMPLOYEE'] }),
  });

  assert.equal(patchRes.status, 200);
  const patchBody = await patchRes.json();
  assert.equal(patchBody.isActive, false);
  assert.deepEqual(patchBody.roles, ['CUSTOMER']); // PATCH ignores roles
  assert.equal(patchBody.password, undefined);
  const [updatedId, patch] = usersRepository.update.mock.calls[0].arguments;
  assert.equal(updatedId, targetId);
  assert.equal(patch.status, 'disabled');
  assert.equal(patch.roles, undefined);
  assert.equal(patch.tokenVersion, 1); // disabling revokes the sessions

  // Step: the target account is now disabled.
  storeUsers({ usersRepository, sessionsRepository }, [...SEEDED_USERS, { ...target, ...patch }]);

  // 403 Forbidden - Login blocked for disabled account (AA01: correct password + disabled account -> ACCOUNT_DISABLED)
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alvo@laprizza.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(loginRes.status, 403);
  assert.equal((await loginRes.json()).error.code, 'ACCOUNT_DISABLED');

  // 400 Bad Request - Empty PATCH (Joi validation)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${targetId}`, {
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
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${adminId}`, {
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
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${adminId.toUpperCase()}`, {
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
      await fetch(`http://127.0.0.1:${port}/api/v2/users/${adminId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'AnotherStrongPassword123!' }),
      })
    ).status,
    200,
  );
  const [ownId, ownPatch] = usersRepository.update.mock.calls.at(-1).arguments;
  assert.equal(ownId, adminId);
  assert.equal(
    await passwordHasher.verify(ownPatch.passwordHash, 'AnotherStrongPassword123!'),
    true,
  );
});

/**
 * Integration tests (AA05) for adding and removing roles.
 * Covers authentication, validation, success, and the self-change refusal with its security log.
 */
test('API PUT and DELETE /users/:id/roles/:role', async (t) => {
  const { server, port, usersRepository, roleChangesRepository, securityLogger } =
    await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const EMP_ID = 'abcdef000000000000000002';
  const login = async (email) =>
    (
      await (
        await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: PASSWORD }),
        })
      ).json()
    ).accessToken;
  const call = (method, path, token) =>
    fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  const adminToken = await login('admin@laprizza.pt');
  const empToken = await login('emp@laprizza.pt');

  const mgrToken = await login('mgr@laprizza.pt');

  // 401 without a session, 403 without the required role (AA06: a Manager is not an Administrator)
  assert.equal((await call('PUT', `/users/${EMP_ID}/roles/CUSTOMER`)).status, 401);
  assert.equal((await call('PUT', `/users/${ADMIN_ID}/roles/EMPLOYEE`, empToken)).status, 403);
  assert.equal((await call('PUT', `/users/${EMP_ID}/roles/MANAGER`, mgrToken)).status, 403);
  assert.equal((await call('DELETE', `/users/${EMP_ID}/roles/EMPLOYEE`, mgrToken)).status, 403);

  // 400 unknown role or invalid id; 404 unknown user
  assert.equal((await call('PUT', `/users/${EMP_ID}/roles/ROOT`, adminToken)).status, 400);
  assert.equal((await call('PUT', '/users/abc/roles/EMPLOYEE', adminToken)).status, 400);
  assert.equal(
    (await call('PUT', '/users/abcdef000000000000000999/roles/EMPLOYEE', adminToken)).status,
    404,
  );

  // 200 add and remove, each recorded with the Administrator and the time (AA06)
  const added = await call('PUT', `/users/${EMP_ID}/roles/CUSTOMER`, adminToken);
  assert.equal(added.status, 200);
  assert.deepEqual((await added.json()).roles, ['EMPLOYEE', 'CUSTOMER']);
  assert.deepEqual(usersRepository.addRoleIfAbsent.mock.calls[0].arguments, [EMP_ID, 'CUSTOMER']);

  const removed = await call('DELETE', `/users/${EMP_ID}/roles/EMPLOYEE`, adminToken);
  assert.equal(removed.status, 200);
  assert.deepEqual(usersRepository.removeRoleIfPresent.mock.calls[0].arguments, [
    EMP_ID,
    'EMPLOYEE',
    { clearCustomerId: false },
  ]);

  const records = roleChangesRepository.insertMany.mock.calls.map((c) => c.arguments[0][0]);
  assert.deepEqual(
    records.map(({ userId, role, action, actor }) => [userId, role, action, actor.userId]),
    [
      [EMP_ID, 'CUSTOMER', 'ASSIGNED', ADMIN_ID],
      [EMP_ID, 'EMPLOYEE', 'REMOVED', ADMIN_ID],
    ],
  );
  assert.ok(records.every((r) => r.at instanceof Date));

  // The Administrator may grant ADMINISTRATOR (AA06)
  assert.equal((await call('PUT', `/users/${EMP_ID}/roles/ADMINISTRATOR`, adminToken)).status, 200);

  // 403 nobody changes their own roles; the refusal is logged without secrets
  const self = await call('PUT', `/users/${ADMIN_ID}/roles/EMPLOYEE`, adminToken);
  assert.equal(self.status, 403);
  const selfBody = await self.json();
  assert.equal(selfBody.error.code, 'SELF_ROLE_CHANGE');
  assert.deepEqual(selfBody.error.details, { roles: ['EMPLOYEE'] });
  assert.equal(usersRepository.addRoleIfAbsent.mock.callCount(), 2);

  const denials = securityLogger.log.mock.calls
    .map((c) => c.arguments)
    .filter(
      ([event, details]) => event === 'ACCESS_DENIED' && details.reason === 'SELF_ROLE_CHANGE',
    );
  assert.equal(denials.length, 1);
  const [, details] = denials[0];
  assert.equal(details.userId, ADMIN_ID);
  assert.equal(details.targetUserId, ADMIN_ID);
  assert.deepEqual(details.attemptedRoles, ['EMPLOYEE']);
  assert.equal(JSON.stringify(details).includes(adminToken), false);
});

/**
 * Integration test (AA05): session routes only need authentication, whatever the roles.
 */
test('API /auth session routes require authentication (requireAuthenticated)', async (t) => {
  const { server, port, sessionsRepository, securityLogger } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  for (const path of ['/auth/logout', '/auth/logout-all', '/auth/password/change']) {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, { method: 'POST' });
    assert.equal(res.status, 401, path);
    assert.equal((await res.json()).error.code, 'TOKEN_MISSING', path);
  }

  const denials = securityLogger.log.mock.calls
    .map((c) => c.arguments)
    .filter(
      ([event, details]) => event === 'ACCESS_DENIED' && details.required === 'authenticated',
    );
  assert.equal(denials.length, 3);
  assert.equal(sessionsRepository.create.mock.callCount(), 0);
});

/**
 * Integration tests (AA05): GET /auth/me returns the current user, read from the database on
 * every request, without secrets; failures are 401 (never 403).
 */
test('API GET /auth/me returns the current user without secrets', async (t) => {
  const { server, port, usersRepository, sessionsRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const login = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: PASSWORD }),
  });
  const { accessToken } = await login.json();
  const me = () =>
    fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  const res = await me();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), [
    'customerId',
    'email',
    'id',
    'permissions',
    'phoneRequired',
    'roles',
    'status',
  ]);
  assert.equal(body.id, ADMIN_ID);
  assert.deepEqual(body.roles, ['ADMINISTRATOR', 'MANAGER']);
  assert.ok(body.permissions.includes('users:manage'));
  assert.equal(body.customerId, null);

  // A role change is visible on the next request, without a new login
  storeUsers({ usersRepository, sessionsRepository }, [
    { ...SEEDED_USERS[0], roles: ['MANAGER', 'EMPLOYEE'] },
    SEEDED_USERS[1],
  ]);
  assert.deepEqual((await (await me()).json()).roles, ['MANAGER', 'EMPLOYEE']);

  // A disabled account is no longer authenticated: 401, never 403
  storeUsers({ usersRepository, sessionsRepository }, [
    { ...SEEDED_USERS[0], status: 'disabled' },
    SEEDED_USERS[1],
  ]);
  const disabled = await me();
  assert.equal(disabled.status, 401);
  assert.equal((await disabled.json()).error.code, 'SESSION_REVOKED');

  // Without a session
  const anonymous = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`);
  assert.equal(anonymous.status, 401);
  assert.equal((await anonymous.json()).error.code, 'TOKEN_MISSING');
});

test('API GET /auth/guest-permissions is public and returns the Guest permissions', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/guest-permissions`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  assert.deepEqual(await res.json(), { permissions: ['catalogue:read'] });
});

/**
 * Integration tests (AA06): replacement invitation, role history and assignable roles.
 */
test('API AA06 /users/:id/invitation, /users/:id/role-history and /users/assignable-roles', async (t) => {
  const { server, port, usersRepository, sessionsRepository, emailService, invitationsRepository, roleChangesRepository } =
    await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const PENDING_ID = 'abcdef000000000000000005';
  storeUsers({ usersRepository, sessionsRepository }, [
    ...SEEDED_USERS,
    { _id: PENDING_ID, email: 'pending@laprizza.pt', roles: ['CUSTOMER'], status: 'inactive', activatedAt: null, tokenVersion: 0 },
  ]);
  const login = async (email) =>
    (
      await (
        await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: PASSWORD }),
        })
      ).json()
    ).accessToken;
  const call = (method, path, token) =>
    fetch(`http://127.0.0.1:${port}/api/v2${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  const adminToken = await login('admin@laprizza.pt');
  const mgrToken = await login('mgr@laprizza.pt');

  // Replacement invitation: the previous one stops working, a new link is sent
  const reissued = await call('POST', `/users/${PENDING_ID}/invitation`, adminToken);
  assert.equal(reissued.status, 201);
  const body = await reissued.json();
  assert.deepEqual(Object.keys(body).sort(), ['expiresAt', 'sent']);
  assert.equal(body.sent, true);
  assert.equal(invitationsRepository.revokePendingForUser.mock.callCount(), 1);
  assert.equal(emailService.send.mock.calls.at(-1).arguments[0].to, 'pending@laprizza.pt');

  // Not for an activated account (adding roles never requires reactivation)
  const active = await call('POST', `/users/abcdef000000000000000002/invitation`, adminToken);
  assert.equal(active.status, 409);
  assert.equal((await active.json()).error.code, 'ACCOUNT_ALREADY_ACTIVATED');

  // Only the Administrator
  assert.equal((await call('POST', `/users/${PENDING_ID}/invitation`, mgrToken)).status, 403);

  // Role history: who changed which role and when
  const at = new Date('2026-11-20T10:00:00Z');
  roleChangesRepository.listForUser.mock.mockImplementation(async () => [
    { role: 'CUSTOMER', action: 'ASSIGNED', actor: { kind: 'SYSTEM', userId: null, process: 'initial-customer-role' }, at },
  ]);
  const history = await call('GET', `/users/${PENDING_ID}/role-history`, adminToken);
  assert.equal(history.status, 200);
  assert.deepEqual(await history.json(), [
    {
      role: 'CUSTOMER',
      action: 'ASSIGNED',
      actor: { kind: 'SYSTEM', userId: null, process: 'initial-customer-role' },
      at: at.toISOString(),
    },
  ]);
  assert.equal((await call('GET', `/users/${PENDING_ID}/role-history`, mgrToken)).status, 403);

  // Assignable roles come from the back end (the SPA never hard-codes role names)
  const roles = await call('GET', '/users/assignable-roles', adminToken);
  assert.equal(roles.status, 200);
  assert.deepEqual((await roles.json()).roles.sort(), ['ADMINISTRATOR', 'CUSTOMER', 'EMPLOYEE', 'MANAGER']);
});
