import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';
import * as cacheModule from '../../src/infrastructure/cache/cache.js';

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
      findByEmailWithPasswordHash: mock.fn(
        async (email) => USERS.find((u) => u.email === email) ?? null,
      ),
      findById: mock.fn(async (id) => userById(id)),
    },
    // One always-active session per user (session id = user id).
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(async (id) =>
        userById(id)
          ? {
              _id: id,
              userId: id,
              tokenVersion: 0,
              expiresAt: new Date(Date.now() + 3_600_000),
              revokedAt: null,
            }
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
    getActiveForecast: mock.fn(async () => null),
    getActiveSupplierScenario: mock.fn(async () => null),
    findActiveScenarioByCode: mock.fn(
      async (code) => seedScenarios().find((s) => s.code === code) ?? null,
    ),
  };
}

/** BOM scenarios (AI01) of the mocked repository: one with its own stock and one without. */
function seedScenarios() {
  const { medium, margherita, dough, cheese } = SEED_IDS;
  const base = {
    name: '[Demo] Test',
    version: 2,
    simulated: true,
    orders: [{ pizzaId: margherita, sizeId: medium, quantity: 3 }],
  };
  return [
    {
      ...base,
      code: 'DEMO-TEST',
      stock: [
        { productId: dough, quantity: 1 },
        { productId: cheese, quantity: 4 },
      ],
    },
    { ...base, code: 'DEMO-NOSTOCK', stock: null },
  ];
}

async function setupTestServer(aiDataRepository = createAiDataRepository()) {
  // The snapshot is cached for 60 s with a fixed key: start every test from an empty cache.
  cacheModule.clearCache?.();

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
  assert.equal(res.status, 200);
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

  // No active forecast or supplier scenario in the mocked repository.
  assert.equal(body.forecast, null);
  assert.equal(body.supplierScenario, null);
});

test('API /ai-data/snapshot does not expose customer data', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  assert.equal(res.status, 200);
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
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(!body.bom.some((b) => b.componentId === SEED_IDS.cheese));
  assert.equal(body.issues.filter((i) => i.code === 'MISSING_OR_INVALID_STOCK_UNITS').length, 2);
});

// ---------------------------------------------------------------------------------------------
// AI01: snapshot of a BOM scenario (?scenarioId=&stockMode=)
// ---------------------------------------------------------------------------------------------

test('API /ai-data/snapshot without scenarioId keeps the original format (WEB07)', async (t) => {
  const { server, port, aiDataRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const body = await (await request(port, 'GET', '/ai-data/snapshot', { token: adminToken })).json();

  assert.deepEqual(Object.keys(body).sort(), [
    'aggregates',
    'bom',
    'forecast',
    'issues',
    'meta',
    'products',
    'sizes',
    'stock',
    'supplierScenario',
  ]);
  assert.deepEqual(body.aggregates, []);
  assert.equal(body.meta.sources, undefined);
  assert.equal(aiDataRepository.findActiveScenarioByCode.mock.callCount(), 0);
});

test('API /ai-data/snapshot?scenarioId&stockMode=scenario returns the scenario snapshot (200)', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot?scenarioId=DEMO-TEST&stockMode=scenario', {
    token: adminToken,
  });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(body.scenario, {
    id: 'DEMO-TEST',
    name: '[Demo] Test',
    version: 2,
    simulated: true,
    stockMode: 'scenario',
  });
  assert.equal(body.meta.simulated, true);
  assert.equal(body.meta.sources.stock.source, 'scenario');
  assert.deepEqual(body.orders[0].items, [
    { pizzaId: SEED_IDS.margherita, sizeId: SEED_IDS.medium, quantity: 3 },
  ]);
  assert.deepEqual(body.pizzas, [
    { id: SEED_IDS.margherita, sizeIds: [SEED_IDS.small, SEED_IDS.medium] },
  ]);
  assert.deepEqual(body.stock, [
    { productId: SEED_IDS.dough, quantity: 1 },
    { productId: SEED_IDS.cheese, quantity: 4 },
  ]);
  // basil has no stock control and no consumption: reported, not invented
  assert.ok(
    body.issues.some(
      (i) => i.code === 'UNMEASURED_NON_STOCK_COMPONENT' && i.componentId === SEED_IDS.basil,
    ),
  );
  assert.equal(body.forecast, null);
  assert.equal(body.supplierScenario, null);
  assert.ok(!JSON.stringify(body).includes('leak@x.pt'));
});

test('API /ai-data/snapshot?stockMode=live uses the real stock (200)', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot?scenarioId=DEMO-TEST&stockMode=live', {
    token: adminToken,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.scenario.stockMode, 'live');
  assert.equal(body.meta.sources.stock.source, 'backend-live');
  assert.deepEqual(body.stock, [
    { productId: SEED_IDS.dough, quantity: 40 },
    { productId: SEED_IDS.cheese, quantity: 25 },
  ]);
});

test('API /ai-data/snapshot: invalid scenario query is 400 and reads nothing', async (t) => {
  const { server, port, aiDataRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const cases = [
    ['?scenarioId=DEMO-TEST', 'object.and'],
    ['?stockMode=live', 'object.and'],
    ['?scenarioId=DEMO-TEST&stockMode=all', 'any.only'],
    ['?scenarioId=demo-test&stockMode=live', 'string.pattern.base'],
  ];
  for (const [query, type] of cases) {
    const res = await request(port, 'GET', `/ai-data/snapshot${query}`, { token: adminToken });
    assert.equal(res.status, 400, query);
    const { error } = await res.json();
    assert.equal(error.code, 'BAD_REQUEST', query);
    assert.ok(
      error.details.some((d) => d.type === type),
      query,
    );
  }
  assert.equal(aiDataRepository.findActiveScenarioByCode.mock.callCount(), 0);
  assert.equal(aiDataRepository.listProducts.mock.callCount(), 0);
});

test('API /ai-data/snapshot: unknown scenario is 404 AI_SCENARIO_NOT_FOUND', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot?scenarioId=DEMO-NOPE&stockMode=scenario', {
    token: adminToken,
  });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'AI_SCENARIO_NOT_FOUND');
});

test('API /ai-data/snapshot: scenario without stock is 400 SCENARIO_WITHOUT_STOCK, live works', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(
    port,
    'GET',
    '/ai-data/snapshot?scenarioId=DEMO-NOSTOCK&stockMode=scenario',
    { token: adminToken },
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'SCENARIO_WITHOUT_STOCK');

  const live = await request(port, 'GET', '/ai-data/snapshot?scenarioId=DEMO-NOSTOCK&stockMode=live', {
    token: adminToken,
  });
  assert.equal(live.status, 200);
});

test('API /ai-data/snapshot with a scenario is only for MANAGER (403 for EMPLOYEE)', async (t) => {
  const { server, port, aiDataRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empToken = await loginAs(port, 'emp@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot?scenarioId=DEMO-TEST&stockMode=scenario', {
    token: empToken,
  });
  assert.equal(res.status, 403);
  assert.equal(aiDataRepository.findActiveScenarioByCode.mock.callCount(), 0);
});
