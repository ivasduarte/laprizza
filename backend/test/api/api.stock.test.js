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

const PRODUCT_WITH_STOCK_ID = 'e0e0e0000000000000000001';
const PRODUCT_NO_STOCK_ID = 'e0e0e0000000000000000002';
const STOCK_ID = 'f0f0f0000000000000000001';

const PRODUCTS = [
  { _id: PRODUCT_WITH_STOCK_ID, name: 'Stocked', description: 'x', stockControlled: true, isActive: true },
  { _id: PRODUCT_NO_STOCK_ID, name: 'NoStock', description: 'y', stockControlled: false, isActive: true },
];

/** Stock document (with the populated product) as returned by the stock repository. */
const storedStock = (quantity) => ({
  _id: STOCK_ID,
  productId: PRODUCTS[0],
  quantity,
});

async function setupTestServer() {
  const productsRepo = {
    findById: mock.fn(async (id) => PRODUCTS.find((p) => p._id === String(id)) ?? null),
  };
  // No stock entry exists until a test programs one.
  const stockRepo = {
    listStock: mock.fn(async () => []),
    findByProductId: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: STOCK_ID, ...data })),
    updateQuantity: mock.fn(async (_productId, quantity) => storedStock(quantity)),
  };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    productsRepository: productsRepo,
    stockRepository: stockRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return {
    server,
    port,
    stockRepo,
    prodWithStockId: PRODUCT_WITH_STOCK_ID,
    prodNoStockId: PRODUCT_NO_STOCK_ID,
  };
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

test('API /stock RBAC: 401 without Token', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/stock')).status, 401);
});

test('API /stock accepts MANAGER and EMPLOYEE roles', async (t) => {
  const { server, port, stockRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const empToken = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await request(port, 'GET', '/stock', { token: adminToken })).status, 200);
  assert.equal((await request(port, 'GET', '/stock', { token: empToken })).status, 200);
  assert.equal(stockRepo.listStock.mock.callCount(), 2);
});

test('API GET and PATCH /stock/:productId Joi validations and Business Rules', async (t) => {
  const { server, port, stockRepo, prodWithStockId, prodNoStockId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  assert.equal((await request(port, 'GET', '/stock/abc', { token: adminToken })).status, 400);

  assert.equal(
    (await request(port, 'GET', `/stock/${prodNoStockId}`, { token: adminToken })).status,
    400,
  );

  // Step: no stock yet -> it is created lazily at 0.
  const getRes = await request(port, 'GET', `/stock/${prodWithStockId}`, { token: adminToken });
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).quantity, 0);
  assert.deepEqual(stockRepo.create.mock.calls[0].arguments[0], {
    productId: prodWithStockId,
    quantity: 0,
  });

  // From now on the stock exists with quantity 0.
  stockRepo.findByProductId.mock.mockImplementation(async () => storedStock(0));

  assert.equal(
    (await request(port, 'PATCH', `/stock/${prodWithStockId}`, { token: adminToken, body: {} }))
      .status,
    400,
  );

  assert.equal(
    (
      await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
        token: adminToken,
        body: { amount: -5, operation: 'increase' },
      })
    ).status,
    400,
  );

  assert.equal(
    (
      await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
        token: adminToken,
        body: { amount: 10, operation: 'add' },
      })
    ).status,
    400,
  );
  assert.equal(stockRepo.updateQuantity.mock.callCount(), 0); // invalid bodies never reach the repository

  const patchInc = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 15, operation: 'increase' },
  });
  assert.equal(patchInc.status, 200);
  assert.equal((await patchInc.json()).quantity, 15);
  assert.deepEqual(stockRepo.updateQuantity.mock.calls[0].arguments, [prodWithStockId, 15]);

  // Step: the stock now has 15 units.
  stockRepo.findByProductId.mock.mockImplementation(async () => storedStock(15));

  const patchDec = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 5, operation: 'decrease' },
  });
  assert.equal(patchDec.status, 200);
  assert.equal((await patchDec.json()).quantity, 10);
  assert.deepEqual(stockRepo.updateQuantity.mock.calls[1].arguments, [prodWithStockId, 10]);

  // Step: the stock now has 10 units.
  stockRepo.findByProductId.mock.mockImplementation(async () => storedStock(10));

  const patchNeg = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 20, operation: 'decrease' },
  });
  assert.equal(patchNeg.status, 400);
  assert.equal(stockRepo.updateQuantity.mock.callCount(), 2);
});
