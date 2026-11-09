import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const PASSWORD = 'StrongPassword123!';
// Same hasher the API uses by default to verify passwords at login.
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const USERS = [
  { _id: 'abcdef000000000000000001', email: 'admin@laprizza.pt', role: 'MANAGER' },
  { _id: 'abcdef000000000000000002', email: 'customer@laprizza.pt', role: 'CUSTOMER' },
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

const PRODUCT_ID = 'e0e0e0000000000000000001';
const HIDDEN_ID = 'e0e0e0000000000000000002';

const PRODUCTS = [
  {
    _id: PRODUCT_ID,
    name: 'Pizza Test',
    description: 'Test',
    price: 10,
    sellable: true,
    stockControlled: false,
    isActive: true,
  },
  {
    _id: HIDDEN_ID,
    name: 'Hidden',
    description: 'Test',
    price: 10,
    sellable: false,
    stockControlled: false,
    isActive: true,
  },
];

async function setupTestServer() {
  const productsRepo = {
    // The repository applies the filter it receives (only the sellable, active product matches).
    listProducts: mock.fn(async () => [PRODUCTS[0]]),
    findById: mock.fn(async (id) => PRODUCTS.find((p) => p._id === String(id)) ?? null),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    productsRepository: productsRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, productsRepo, prodId: PRODUCT_ID };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).accessToken;
}

function request(port, method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('API /catalogue RBAC: 401 without Token', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/catalogue')).status, 401);
});

test('API /catalogue accepts CUSTOMER and MANAGER roles', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  assert.equal((await request(port, 'GET', '/catalogue', { token: adminToken })).status, 200);
  assert.equal((await request(port, 'GET', '/catalogue', { token: customerToken })).status, 200);
});

test('API GET /catalogue lists only sellable and active products', async (t) => {
  const { server, port, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  const res = await request(port, 'GET', '/catalogue', { token: customerToken });
  assert.equal(res.status, 200);

  const items = await res.json();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Pizza Test');
  assert.equal(items[0].sellable, undefined);
  assert.equal(items[0].isActive, undefined);
  const filter = productsRepo.listProducts.mock.calls[0].arguments[0];
  assert.equal(filter.isActive, true);
  assert.equal(filter.sellable, true);
});

test('API GET /catalogue/:id returns product or 404', async (t) => {
  const { server, port, productsRepo, prodId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  assert.equal(
    (await request(port, 'GET', `/catalogue/${NON_EXISTENT_ID}`, { token: customerToken })).status,
    404,
  );

  assert.equal(
    (await request(port, 'GET', '/catalogue/id_invalido', { token: customerToken })).status,
    400,
  );
  assert.equal(productsRepo.findById.mock.callCount(), 1); // the invalid id never reaches it

  const res = await request(port, 'GET', `/catalogue/${prodId}`, { token: customerToken });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).name, 'Pizza Test');
});
