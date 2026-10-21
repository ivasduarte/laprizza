import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyCustomersRepository } from '../infrastructure/customers.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

/**
 * Setup isolated test environment with injected dummy repositories.
 */
async function setupTestServer({ postalCodeValidator } = {}) {
  const usersRepo = createDummyUsersRepository();
  const customersRepo = createDummyCustomersRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    customersRepository: customersRepo,
    postalCodeValidator,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  // Seed two different roles for RBAC testing
  await registerUser(
    { email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    usersRepo,
  );
  await registerUser(
    { email: 'emp@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    usersRepo,
  );

  return { server, port, customersRepo };
}

/**
 * Logs in as the seeded MANAGER and returns a request helper bound to that token.
 */
async function loginAsManager(port) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const { token } = await res.json();

  return (method, path, body) =>
    fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

/**
 * Builds a valid customer payload, with optional overrides.
 */
const validCustomer = (overrides = {}) => ({
  name: 'Cliente Teste',
  email: 'cliente@laprizza.pt',
  phoneNumber: '912345678',
  address: { street: 'R', houseNumber: '1', postalCode: '4460-123', city: 'S', district: 'P' },
  ...overrides,
});

/**
 * Integration Test: RBAC Middleware.
 * Ensures the CUSTOMER endpoints are exclusively accessible by MANAGER roles.
 */
test('API /customers strictly enforces MANAGER role access', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const rEmp = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await rEmp.json()).token;

  // EMPLOYEE trying to list customers (Blocked)
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/customers`, {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  assert.equal(res.status, 403);
});

/**
 * Integration Test: Customer Lifecycle and Joi Validations.
 * Validates payload structures, success paths, and conflict scenarios.
 */
test('API /customers full lifecycle and payload validation', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const rAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await rAdmin.json()).token;

  const validPayload = {
    name: 'Integração',
    email: 'int@laprizza.pt',
    phoneNumber: '912345678',
    address: { street: 'R', houseNumber: '1', postalCode: '4460-123', city: 'S', district: 'P' },
  };

  // 1. POST - Invalid Payload (Missing address) -> 400
  const postBad = await fetch(`http://127.0.0.1:${port}/api/v1/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Falta Morada',
      email: 'int@laprizza.pt',
      phoneNumber: '912345678',
    }),
  });
  assert.equal(postBad.status, 400);

  // 2. POST - Valid Creation -> 201
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v1/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(postRes.status, 201);
  const targetId = (await postRes.json()).id;

  // 3. GET - Fetch created Customer -> 200
  const getRes = await fetch(`http://127.0.0.1:${port}/api/v1/customers/${targetId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).name, 'Integração');

  // 4. PATCH - Valid partial update (Inactivation) -> 200
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v1/customers/${targetId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(patchRes.status, 200);
  assert.equal((await patchRes.json()).isActive, false);

  // 5. PATCH - Empty Payload -> 400 (min 1 rule)
  const patchEmpty = await fetch(`http://127.0.0.1:${port}/api/v1/customers/${targetId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(patchEmpty.status, 400);

  // 6. GET - search sent twice (array) -> 400
  const searchBad = await fetch(`http://127.0.0.1:${port}/api/v1/customers?search=a&search=b`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(searchBad.status, 400);
});

test('API /customers returns 400 when postal code and city do not match', async (t) => {
  const { server, port } = await setupTestServer({
    postalCodeValidator: { isValidMatch: async () => false },
  });
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const rAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await rAdmin.json()).token;

  const res = await fetch(`http://127.0.0.1:${port}/api/v1/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Morada Errada',
      email: 'morada@laprizza.pt',
      phoneNumber: '912345678',
      address: { street: 'R', houseNumber: '1', postalCode: '4460-123', city: 'S', district: 'P' },
    }),
  });
  assert.equal(res.status, 400);
});

/**
 * Integration Test: duplicated dietary restrictions are rejected by Joi on create and update.
 */
test('API /customers rejects duplicated dietary restrictions on create and update', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAsManager(port);
  const allergenId = '65231abcd345678901234567';

  const postDuplicated = await request(
    'POST',
    '/customers',
    validCustomer({ dietaryRestrictions: [allergenId, allergenId] }),
  );
  assert.equal(postDuplicated.status, 400);

  const created = await request(
    'POST',
    '/customers',
    validCustomer({ dietaryRestrictions: [allergenId] }),
  );
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const patchDuplicated = await request('PATCH', `/customers/${id}`, {
    dietaryRestrictions: [allergenId, allergenId],
  });
  assert.equal(patchDuplicated.status, 400);
});

/**
 * Integration Test: uniqueness of email and phone number, and phone validation on update.
 */
test('API /customers enforces uniqueness and phone validation on create and update', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAsManager(port);

  const first = await request('POST', '/customers', validCustomer());
  assert.equal(first.status, 201);
  const second = await request(
    'POST',
    '/customers',
    validCustomer({ email: 'segundo@laprizza.pt', phoneNumber: '922222222' }),
  );
  assert.equal(second.status, 201);
  const secondId = (await second.json()).id;

  // Create: same email
  const dupEmail = await request('POST', '/customers', validCustomer({ phoneNumber: '933333333' }));
  assert.equal(dupEmail.status, 409);
  assert.equal((await dupEmail.json()).error.message, 'Email already in use.');

  // Create: same phone number written in another format
  const dupPhone = await request(
    'POST',
    '/customers',
    validCustomer({ email: 'outro@laprizza.pt', phoneNumber: '+351 912 345 678' }),
  );
  assert.equal(dupPhone.status, 409);
  assert.equal((await dupPhone.json()).error.message, 'Phone number already in use.');

  // Update: email and phone number of another customer
  const patchEmail = await request('PATCH', `/customers/${secondId}`, {
    email: 'cliente@laprizza.pt',
  });
  assert.equal(patchEmail.status, 409);
  assert.equal((await patchEmail.json()).error.message, 'Email already in use.');

  const patchPhone = await request('PATCH', `/customers/${secondId}`, {
    phoneNumber: '+351 912 345 678',
  });
  assert.equal(patchPhone.status, 409);
  assert.equal((await patchPhone.json()).error.message, 'Phone number already in use.');

  // Update: invalid phone number is blocked by the domain rule
  const patchInvalid = await request('PATCH', `/customers/${secondId}`, { phoneNumber: 'abc' });
  assert.equal(patchInvalid.status, 400);

  // Update: keeping its own phone number is not a conflict
  const patchOwn = await request('PATCH', `/customers/${secondId}`, { phoneNumber: '922222222' });
  assert.equal(patchOwn.status, 200);
});

/**
 * Integration Test: search by name, email and phone number.
 */
test('API /customers search filters by name, email and phone number', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAsManager(port);

  await request(
    'POST',
    '/customers',
    validCustomer({ name: 'Maria Santos', email: 'maria@laprizza.pt', phoneNumber: '912345678' }),
  );
  await request(
    'POST',
    '/customers',
    validCustomer({ name: 'Joao Silva', email: 'joao@laprizza.pt', phoneNumber: '223456789' }),
  );

  const search = async (term) => {
    const res = await request('GET', `/customers?search=${encodeURIComponent(term)}`);
    assert.equal(res.status, 200);
    return res.json();
  };

  assert.equal((await search('')).length, 2); // empty term returns everything
  assert.equal((await search('MARIA')).length, 1); // name, case-insensitive
  assert.equal((await search('joao@laprizza')).length, 1); // email
  assert.equal((await search('2234')).length, 1); // phone number
  assert.equal((await search('xyz')).length, 0); // no match
});