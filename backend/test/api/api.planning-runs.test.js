import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const USERS = [
  { _id: 'abcdef000000000000000001', email: 'admin@laprizza.pt', roles: ['MANAGER'] },
  { _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', roles: ['EMPLOYEE'] },
].map((user) => ({
  ...user,
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
}));

function createAuthMocks() {
  const userById = (id) => USERS.find((u) => u._id === String(id)) ?? null;
  return {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(
        async (email) => USERS.find((u) => u.email === email) ?? null,
      ),
      findById: mock.fn(async (id) => userById(id)),
    },
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

const PIZZA = 'bbbbbbbbbbbbbbbbbbbbbb01';
const MEDIUM = 'aaaaaaaaaaaaaaaaaaaaaa02';
const DOUGH = 'cccccccccccccccccccccc01';
const FORECAST_ID = 'f0ca57000000000000000001';
const RUN_ID = '0123456789abcdef01234567';

const FORECAST = {
  _id: FORECAST_ID,
  name: 'Week 47',
  version: 2,
  startDate: '2026-11-23',
  endDate: '2026-11-29',
  entries: [{ date: '2026-11-23', productId: PIZZA, sizeId: MEDIUM, quantity: 5 }],
};

/** Read-only catalogue + AI01 scenario, enough for the snapshot service. */
function createAiDataRepository() {
  return {
    listProducts: mock.fn(async () => [
      { _id: PIZZA, name: 'Margherita', sellable: true },
      {
        _id: DOUGH,
        name: 'Dough',
        stockControlled: true,
        pizzaComponentTypeId: 't1',
        sizeConfigurations: [{ pizzaSizeId: MEDIUM, stockUnitsConsumed: 1 }],
      },
    ]),
    listSizes: mock.fn(async () => [{ _id: MEDIUM, name: 'Medium' }]),
    listPredefinedPizzas: mock.fn(async () => [
      { productId: PIZZA, sizeIds: [MEDIUM], defaultConfiguration: { componentIds: [DOUGH] } },
    ]),
    listStock: mock.fn(async () => [{ productId: DOUGH, quantity: 40 }]),
    getActiveForecast: mock.fn(async () => null),
    getActiveSupplierScenario: mock.fn(async () => null),
    findForecastById: mock.fn(async (id) => (id === FORECAST_ID ? FORECAST : null)),
    findSupplierScenarioById: mock.fn(async () => null),
    findActiveScenarioByCode: mock.fn(async (code) =>
      code === 'DEMO-TEST'
        ? { code, name: '[Demo] Test', version: 1, simulated: true, orders: [], stock: [] }
        : null,
    ),
  };
}

async function setupTestServer() {
  const stored = [];
  const planningRunRepository = {
    create: mock.fn(async (data) => {
      const run = { _id: RUN_ID, createdAt: new Date('2026-11-18T10:00:00.000Z'), ...data };
      stored.push(run);
      return run;
    }),
    list: mock.fn(async () => stored),
    findById: mock.fn(async (id) => stored.find((r) => r._id === id) ?? null),
  };
  const aiServiceClient = {
    calculate: mock.fn(async () => ({
      status: 'ok',
      simulation: true,
      summary: { totalCostEur: 0, productsToBuy: 0, feasible: true },
    })),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    aiDataRepository: createAiDataRepository(),
    aiServiceClient,
    planningRunRepository,
  }).listen(0);
  await once(server, 'listening');
  return { server, port: server.address().port, planningRunRepository, aiServiceClient };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { accessToken } = await res.json();
  return (method, path, body) =>
    fetch(`http://127.0.0.1:${port}/api/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

test('API /planning: a forecast execution is recorded with the versions it used and can be consulted', async (t) => {
  const { server, port, planningRunRepository } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const request = await loginAs(port, 'admin@laprizza.pt');

  const exec = await request('POST', '/planning/requirements', {
    scenarioId: 'DEMO-TEST',
    stockMode: 'live',
    forecastId: FORECAST_ID,
  });
  assert.equal(exec.status, 200);
  const answer = await exec.json();
  assert.equal(answer.runId, RUN_ID);
  assert.equal(answer.status, 'ok');

  const record = planningRunRepository.create.mock.calls[0].arguments[0];
  assert.deepEqual(record.forecast, { id: FORECAST_ID, name: 'Week 47', version: 2 });
  assert.equal(record.request.forecastId, FORECAST_ID);
  assert.equal(record.stockSource.source, 'backend-live');
  assert.match(record.snapshotId, /^[0-9a-f]{16}$/);
  assert.match(record.bomVersion, /^[0-9a-f]{16}$/);
  assert.equal(record.requestedBy, 'abcdef000000000000000001');

  const list = await request('GET', `/planning/runs?kind=requirements&forecastId=${FORECAST_ID}`);
  assert.equal(list.status, 200);
  const runs = await list.json();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].forecast.version, 2);
  assert.equal(runs[0].feasible, true);
  assert.equal(runs[0].result, undefined);
  assert.deepEqual(planningRunRepository.list.mock.calls[0].arguments, [
    { kind: 'requirements', forecastId: FORECAST_ID },
  ]);

  const one = await request('GET', `/planning/runs/${RUN_ID}`);
  assert.equal(one.status, 200);
  assert.equal((await one.json()).result.status, 'ok');
});

test('API /planning/runs: validations, 404 and RBAC', async (t) => {
  const { server, port, planningRunRepository, aiServiceClient } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const manager = await loginAs(port, 'admin@laprizza.pt');
  const employee = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await manager('GET', '/planning/runs?kind=other')).status, 400);
  assert.equal((await manager('GET', '/planning/runs?forecastId=abc')).status, 400);
  assert.equal((await manager('GET', '/planning/runs/not-an-id')).status, 400);

  const missing = await manager('GET', '/planning/runs/aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'PLANNING_RUN_NOT_FOUND');

  assert.equal((await employee('GET', '/planning/runs')).status, 403);
  assert.equal((await employee('GET', `/planning/runs/${RUN_ID}`)).status, 403);
  assert.equal(planningRunRepository.list.mock.callCount(), 0);

  // A failed calculation (unknown forecast) records nothing.
  const notFound = await manager('POST', '/planning/requirements', {
    scenarioId: 'DEMO-TEST',
    stockMode: 'live',
    forecastId: 'f0ca57000000000000000009',
  });
  assert.equal(notFound.status, 404);
  assert.equal(aiServiceClient.calculate.mock.callCount(), 0);
  assert.equal(planningRunRepository.create.mock.callCount(), 0);

  const noToken = await fetch(`http://127.0.0.1:${port}/api/v2/planning/runs`);
  assert.equal(noToken.status, 401);
});
