import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '..//infrastructure/users.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

/**
 * Initializes the test server with an in-memory dummy repository.
 * Seeds initial MANAGER and EMPLOYEE accounts for testing to avoid touching the real database.
 *
 * @returns {Promise<{server: import('node:http').Server, port: number}>} An object containing the running server instance and its allocated port.
 */
async function setupTestServer() {
  const dummyRepo = createDummyUsersRepository();
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: dummyRepo,
  }).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  await registerUser(
    { email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    dummyRepo,
  );
  await registerUser(
    { email: 'emp@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    dummyRepo,
  );

  return { server, port };
}

/**
 * Integration tests for the authentication login flow.
 * Validates missing fields, invalid credentials, and successful token generation.
 */
test('API POST /auth/login (400, 401, 200)', async (t) => {
  const { server, port } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  let res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt' }),
  });
  assert.equal(res.status, 400);

  res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'Wrong!' }),
  });
  assert.equal(res.status, 401);

  res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).token);
});

/**
 * Integration tests for user creation and listing.
 * Validates Role-Based Access Control (RBAC), unique email constraints, and DTO password omission.
 */
test('API GET and POST /users (Roles and validations)', async (t) => {
  const { server, port } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).token;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).token;

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

  // 409 Conflict (Duplicate email)
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

  // 200 OK GET - Validates if the DTO omits the password in the list
  const listRes = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listBody[0].password, undefined);
});

/**
 * Integration tests for querying and updating specific users by ID.
 * Validates parameter formats, account deactivation, and Manager self-protection rules.
 */
test('API GET and PATCH /users/:id (Consult and Update)', async (t) => {
  const { server, port } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const r1 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await r1.json()).token;

  const r2 = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await r2.json()).token;

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

  // 401 Unauthorized - Login blocked for disabled account
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'alvo@laprizza.pt', password: 'StrongPassword123!' }),
  });
  assert.equal(loginRes.status, 401);

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

  const decodedAdmin = jwt.verify(adminToken, process.env.JWT_SECRET);
  const adminId = decodedAdmin.userId;

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
});