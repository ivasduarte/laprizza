import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
// Same hasher the API uses by default to verify passwords at login.
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const USERS = [
  { _id: 'abcdef000000000000000001', email: 'admin@laprizza.pt', role: 'MANAGER' },
  { _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', role: 'EMPLOYEE' },
].map((user) => ({
  ...user,
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
}));

/** Mocked users repository and auth infrastructure: just enough to log in through the API. */
function createAuthMocks() {
  const userById = (id) => USERS.find((u) => u._id === String(id)) ?? null;
  return {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(async (email) => USERS.find((u) => u.email === email) ?? null),
      findById: mock.fn(async (id) => userById(id)),
    },
    // One always-active session per user (session id = user id).
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(async (id) =>
        userById(id)
          ? { _id: id, userId: id, tokenVersion: 0, expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null }
          : null,
      ),
    },
    securityLogger: { log: mock.fn() },
  };
}

const CUSTOMER_ID = 'c0c0c0000000000000000001';
const SECOND_CUSTOMER_ID = 'c0c0c0000000000000000002';

const duplicateKeyError = (field) =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { [field]: 1 } });

/**
 * Setup isolated test environment with injected mocked repositories.
 * Nothing is stored: each test programs the answers of the repository for its steps.
 */
async function setupTestServer({ postalCodeValidator = { isValidMatch: mock.fn(async () => true) } } = {}) {
  const customersRepo = {
    listCustomers: mock.fn(async () => []),
    findById: mock.fn(async () => undefined),
    create: mock.fn(async (data) => ({
      _id: CUSTOMER_ID,
      isActive: true,
      dietaryRestrictions: [],
      ...data,
    })),
    update: mock.fn(async (id, data) => ({ _id: id, isActive: true, ...data })),
  };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    customersRepository: customersRepo,
    postalCodeValidator,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, customersRepo, postalCodeValidator };
}

/** Programs the repository so that `customer` is stored (findById + update merge into it). */
function storeCustomer(customersRepo, customer) {
  customersRepo.findById.mock.mockImplementation(async (id) =>
    String(id) === customer._id ? customer : undefined,
  );
  customersRepo.update.mock.mockImplementation(async (_id, data) => ({ ...customer, ...data }));
}

/**
 * Logs in as the seeded MANAGER and returns a request helper bound to that token.
 */
async function loginAsManager(port) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const { accessToken: token } = await res.json();

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
    body: JSON.stringify({ email: 'emp@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const empToken = (await rEmp.json()).accessToken;

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
  const { server, port, customersRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const rAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await rAdmin.json()).accessToken;

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
  assert.equal(customersRepo.create.mock.callCount(), 0);

  // 2. POST - Valid Creation -> 201
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v1/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(postRes.status, 201);
  const targetId = (await postRes.json()).id;
  assert.equal(customersRepo.create.mock.calls[0].arguments[0].email, 'int@laprizza.pt');

  // From now on the customer is stored.
  storeCustomer(customersRepo, { _id: targetId, ...validPayload, isActive: true });

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
  assert.deepEqual(customersRepo.update.mock.calls[0].arguments, [targetId, { isActive: false }]);

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
  assert.equal(customersRepo.listCustomers.mock.callCount(), 0);
});

test('API /customers returns 400 when postal code and city do not match', async (t) => {
  const { server, port, customersRepo, postalCodeValidator } = await setupTestServer({
    postalCodeValidator: { isValidMatch: mock.fn(async () => false) },
  });
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const rAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@laprizza.pt', password: 'StrongPassword123!' }),
  });
  const adminToken = (await rAdmin.json()).accessToken;

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
  assert.deepEqual(postalCodeValidator.isValidMatch.mock.calls[0].arguments, ['4460-123', 'S']);
  assert.equal(customersRepo.create.mock.callCount(), 0);
});

/**
 * Integration Test: duplicated dietary restrictions are rejected by Joi on create and update.
 */
test('API /customers rejects duplicated dietary restrictions on create and update', async (t) => {
  const { server, port, customersRepo } = await setupTestServer();
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
  assert.equal(customersRepo.create.mock.callCount(), 1); // the duplicated payload never reached it
  storeCustomer(customersRepo, { _id: id, ...validCustomer({ dietaryRestrictions: [allergenId] }) });

  const patchDuplicated = await request('PATCH', `/customers/${id}`, {
    dietaryRestrictions: [allergenId, allergenId],
  });
  assert.equal(patchDuplicated.status, 400);
  assert.equal(customersRepo.update.mock.callCount(), 0);
});

/**
 * Integration Test: uniqueness of email and phone number, and phone validation on update.
 */
test('API /customers enforces uniqueness and phone validation on create and update', async (t) => {
  const { server, port, customersRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAsManager(port);

  const first = await request('POST', '/customers', validCustomer());
  assert.equal(first.status, 201);
  customersRepo.create.mock.mockImplementationOnce(async (data) => ({
    _id: SECOND_CUSTOMER_ID,
    isActive: true,
    ...data,
  }));
  const second = await request(
    'POST',
    '/customers',
    validCustomer({ email: 'segundo@laprizza.pt', phoneNumber: '922222222' }),
  );
  assert.equal(second.status, 201);
  const secondId = (await second.json()).id;
  assert.equal(secondId, SECOND_CUSTOMER_ID);
  storeCustomer(customersRepo, {
    _id: secondId,
    ...validCustomer({ email: 'segundo@laprizza.pt', phoneNumber: '922222222' }),
  });

  // Create: same email (the unique index rejects it)
  customersRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('email');
  });
  const dupEmail = await request('POST', '/customers', validCustomer({ phoneNumber: '933333333' }));
  assert.equal(dupEmail.status, 409);
  assert.equal((await dupEmail.json()).error.message, 'Email already in use.');

  // Create: same phone number written in another format
  customersRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('phoneNumber');
  });
  const dupPhone = await request(
    'POST',
    '/customers',
    validCustomer({ email: 'outro@laprizza.pt', phoneNumber: '+351 912 345 678' }),
  );
  assert.equal(dupPhone.status, 409);
  assert.equal((await dupPhone.json()).error.message, 'Phone number already in use.');
  // The phone number is normalized before reaching the repository.
  assert.equal(customersRepo.create.mock.calls.at(-1).arguments[0].phoneNumber, '912345678');

  // Update: email and phone number of another customer
  customersRepo.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('email');
  });
  const patchEmail = await request('PATCH', `/customers/${secondId}`, {
    email: 'cliente@laprizza.pt',
  });
  assert.equal(patchEmail.status, 409);
  assert.equal((await patchEmail.json()).error.message, 'Email already in use.');

  customersRepo.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('phoneNumber');
  });
  const patchPhone = await request('PATCH', `/customers/${secondId}`, {
    phoneNumber: '+351 912 345 678',
  });
  assert.equal(patchPhone.status, 409);
  assert.equal((await patchPhone.json()).error.message, 'Phone number already in use.');

  // Update: invalid phone number is blocked by the domain rule
  const patchInvalid = await request('PATCH', `/customers/${secondId}`, { phoneNumber: 'abc' });
  assert.equal(patchInvalid.status, 400);
  assert.equal(customersRepo.update.mock.callCount(), 2);

  // Update: keeping its own phone number is not a conflict
  const patchOwn = await request('PATCH', `/customers/${secondId}`, { phoneNumber: '922222222' });
  assert.equal(patchOwn.status, 200);
  assert.deepEqual(customersRepo.update.mock.calls.at(-1).arguments, [
    secondId,
    { phoneNumber: '922222222' },
  ]);
});

/**
 * Integration Test: search by name, email and phone number.
 */
test('API /customers search filters by name, email and phone number', async (t) => {
  const { server, port, customersRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAsManager(port);

  const maria = {
    _id: CUSTOMER_ID,
    ...validCustomer({ name: 'Maria Santos', email: 'maria@laprizza.pt', phoneNumber: '912345678' }),
  };
  const joao = {
    _id: SECOND_CUSTOMER_ID,
    ...validCustomer({ name: 'Joao Silva', email: 'joao@laprizza.pt', phoneNumber: '223456789' }),
  };
  // Programmed answer of the repository for each search, in order.
  [[maria, joao], [maria], [joao], [joao], []].forEach((answer, call) => {
    customersRepo.listCustomers.mock.mockImplementationOnce(async () => answer, call);
  });

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

  // The search term reaches the repository, which filters name, email and phone number.
  assert.deepEqual(
    customersRepo.listCustomers.mock.calls.slice(1).map((c) => c.arguments[0].search),
    ['MARIA', 'joao@laprizza', '2234', 'xyz'],
  );
});