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

const SEED_IDS = {
  small: 'aaaaaaaaaaaaaaaaaaaaaa01',
  medium: 'aaaaaaaaaaaaaaaaaaaaaa02',
  margherita: 'bbbbbbbbbbbbbbbbbbbbbb01',
  dough: 'cccccccccccccccccccccc01',
  cheese: 'cccccccccccccccccccccc02',
  basil: 'cccccccccccccccccccccc03',
};

const cfg = (pizzaSizeId, stockUnitsConsumed) => ({ pizzaSizeId, stockUnitsConsumed });

/** Products returned by the mocked repository (a fresh copy per call of this function). */
function seedProducts() {
  const { small, medium, margherita, dough, cheese, basil } = SEED_IDS;
  return [
    // customerEmail is a canary: it must never reach the snapshot.
    {
      _id: margherita,
      name: 'Margherita',
      sellable: true,
      stockControlled: false,
      customerEmail: 'leak@x.pt',
    },
    {
      _id: dough,
      name: 'Dough',
      stockControlled: true,
      pizzaComponentTypeId: 't1',
      sizeConfigurations: [cfg(small, 1), cfg(medium, 1)],
    },
    {
      _id: cheese,
      name: 'Mozzarella',
      stockControlled: true,
      pizzaComponentTypeId: 't3',
      sizeConfigurations: [cfg(small, 1), cfg(medium, 2)],
    },
    {
      _id: basil,
      name: 'Basil',
      stockControlled: false,
      pizzaComponentTypeId: 't4',
      sizeConfigurations: [],
    },
  ];
}

/** Mocked read-only AI data repository answering with the seed data. */
function createAiDataRepository(products = seedProducts()) {
  const { small, medium, margherita, dough, cheese, basil } = SEED_IDS;
  return {
    listProducts: mock.fn(async () => products),
    listSizes: mock.fn(async () => [
      { _id: small, name: 'Small' },
      { _id: medium, name: 'Medium' },
    ]),
    listPredefinedPizzas: mock.fn(async () => [
      {
        productId: margherita,
        sizeIds: [small, medium],
        defaultConfiguration: { componentIds: [dough, cheese, basil] },
      },
    ]),
    listStock: mock.fn(async () => [
      { productId: dough, quantity: 40 },
      { productId: cheese, quantity: 25 },
    ]),
  };
}

async function setupTestServer(aiDataRepository = createAiDataRepository()) {
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    aiDataRepository,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, aiDataRepository };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).accessToken;
}

function request(port, method, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`http://127.0.0.1:${port}/api/v1${path}`, { method, headers });
}

test('API /ai-data/snapshot RBAC: 401 without token, 403 for EMPLOYEE, 200 for MANAGER', async (t) => {
  const { server, port, aiDataRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/ai-data/snapshot')).status, 401);

  const empToken = await loginAs(port, 'emp@laprizza.pt');
  assert.equal((await request(port, 'GET', '/ai-data/snapshot', { token: empToken })).status, 403);
  assert.equal(aiDataRepository.listProducts.mock.callCount(), 0);

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  assert.equal(
    (await request(port, 'GET', '/ai-data/snapshot', { token: adminToken })).status,
    200,
  );
});

test('API /ai-data/snapshot returns the planning data for the knowledge base', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  const body = await res.json();

  assert.match(body.meta.snapshotId, /^[0-9a-f]{16}$/);
  assert.equal(body.meta.simulated, false);
  assert.equal(body.sizes.length, 2);

  // Only stock-controlled components are in the BOM.
  assert.equal(body.bom.length, 4);
  assert.ok(!body.bom.some((b) => b.componentId === SEED_IDS.basil));
  assert.deepEqual(
    body.bom.find((b) => b.sizeId === SEED_IDS.medium && b.componentId === SEED_IDS.cheese),
    {
      pizzaId: SEED_IDS.margherita,
      sizeId: SEED_IDS.medium,
      componentId: SEED_IDS.cheese,
      quantity: 2,
    },
  );

  assert.deepEqual(body.stock, [
    { productId: SEED_IDS.dough, quantity: 40 },
    { productId: SEED_IDS.cheese, quantity: 25 },
  ]);
  assert.deepEqual(body.issues, []);
});

test('API /ai-data/snapshot does not expose customer data', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  assert.ok(!(await res.text()).includes('leak@x.pt'));
});

test('API /ai-data/snapshot reports data problems in issues instead of inventing values', async (t) => {
  const products = seedProducts();
  products.find((p) => p._id === SEED_IDS.cheese).sizeConfigurations = [];

  const { server, port } = await setupTestServer(createAiDataRepository(products));
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const body = await (
    await request(port, 'GET', '/ai-data/snapshot', { token: adminToken })
  ).json();

  assert.ok(!body.bom.some((b) => b.componentId === SEED_IDS.cheese));
  assert.equal(body.issues.filter((i) => i.code === 'MISSING_OR_INVALID_STOCK_UNITS').length, 2);
});
