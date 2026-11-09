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

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  const { accessToken: token } = await res.json();
  return (method, path, body) =>
    fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

const SCENARIO_ID = '5ce4a0000000000000000001';
const OTHER_SCENARIO_ID = '5ce4a0000000000000000002';
const PRODUCT_ID = 'd0d0c7000000000000000001';

const duplicateKeyError = () =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { name: 1 } });

const validOffer = () => ({
  supplierId: 'SUP-1',
  priceEur: 1.5,
  stockUnits: 100,
  leadTimeDays: 2,
  supplyLimit: 50,
});

const validScenario = () => ({
  name: 'Cenário Base',
  simulated: true,
  suppliers: [{ id: 'SUP-1', name: 'Fornecedor A' }],
  products: [{ productId: PRODUCT_ID, offers: [validOffer()] }],
});

async function setupTestServer() {
  // Nothing is stored until a test programs the answers of each step.
  const scenarioRepo = {
    list: mock.fn(async () => []),
    search: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: SCENARIO_ID, ...data })),
    update: mock.fn(async (id, data) => ({ _id: id, ...validScenario(), isActive: true, ...data })),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    supplierScenarioRepository: scenarioRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, scenarioRepo };
}

test('API /supplier-scenarios RBAC: Only MANAGER can create and update', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/supplier-scenarios', validScenario());
  assert.equal(postEmp.status, 403);
  assert.equal(scenarioRepo.create.mock.callCount(), 0);

  const putEmp = await empRequest('PUT', `/supplier-scenarios/${SCENARIO_ID}`, {
    isActive: false,
  });
  assert.equal(putEmp.status, 403);
  assert.equal(scenarioRepo.update.mock.callCount(), 0);

  const postMgr = await managerRequest('POST', '/supplier-scenarios', validScenario());
  assert.equal(postMgr.status, 201);
  assert.equal(scenarioRepo.create.mock.callCount(), 1);
});

test('API /supplier-scenarios EMPLOYEE cannot read (MANAGER only)', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await empRequest('GET', '/supplier-scenarios')).status, 403);
  assert.equal((await empRequest('GET', `/supplier-scenarios/${SCENARIO_ID}`)).status, 403);
  assert.equal(scenarioRepo.list.mock.callCount(), 0);
  assert.equal(scenarioRepo.findById.mock.callCount(), 0);
});

test('API /supplier-scenarios requires authentication', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const res = await fetch(`http://127.0.0.1:${port}/api/v1/supplier-scenarios`);
  assert.equal(res.status, 401);
});

test('API /supplier-scenarios lifecycle and validations', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postBad = await request('POST', '/supplier-scenarios', {});
  assert.equal(postBad.status, 400);
  assert.equal(scenarioRepo.create.mock.callCount(), 0);

  const postRes = await request('POST', '/supplier-scenarios', validScenario());
  assert.equal(postRes.status, 201);
  const { id } = await postRes.json();
  assert.equal(id, SCENARIO_ID);

  // Unknown fields are stripped before reaching the repository.
  const postExtra = await request('POST', '/supplier-scenarios', {
    ...validScenario(),
    hacker: true,
  });
  assert.equal(postExtra.status, 201);
  const stored = scenarioRepo.create.mock.calls[1].arguments[0];
  assert.equal(stored.hacker, undefined);
  assert.equal(stored.isActive, true);

  // Step: the name is now taken.
  scenarioRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError();
  });
  const postDup = await request('POST', '/supplier-scenarios', validScenario());
  assert.equal(postDup.status, 409);

  // Step: the scenario exists and is active.
  const storedScenario = { _id: SCENARIO_ID, ...validScenario(), isActive: true };
  scenarioRepo.findById.mock.mockImplementation(async (scenarioId) =>
    scenarioId === SCENARIO_ID ? storedScenario : null,
  );

  const getRes = await request('GET', `/supplier-scenarios/${id}`);
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).name, 'Cenário Base');

  const getMissing = await request('GET', `/supplier-scenarios/${OTHER_SCENARIO_ID}`);
  assert.equal(getMissing.status, 404);

  const getBadId = await request('GET', '/supplier-scenarios/not-an-id');
  assert.equal(getBadId.status, 400);

  const putBad = await request('PUT', `/supplier-scenarios/${id}`, { name: 'Outro' });
  assert.equal(putBad.status, 400);

  const putActive = await request('PUT', `/supplier-scenarios/${id}`, { isActive: true });
  assert.equal(putActive.status, 400);

  const putDeactivate = await request('PUT', `/supplier-scenarios/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);
  assert.deepEqual(scenarioRepo.update.mock.calls[0].arguments, [SCENARIO_ID, { isActive: false }]);

  // Step: the scenario is now inactive.
  scenarioRepo.findById.mock.mockImplementation(async () => ({
    ...storedScenario,
    isActive: false,
  }));
  const getDeactivated = await request('GET', `/supplier-scenarios/${id}`);
  assert.equal(getDeactivated.status, 404);
});

test('API /supplier-scenarios validates body fields', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const withOffer = (changes) => ({
    ...validScenario(),
    products: [{ productId: PRODUCT_ID, offers: [{ ...validOffer(), ...changes }] }],
  });
  const { suppliers, products, ...rest } = validScenario();
  const invalidBodies = [
    { ...validScenario(), name: '' },
    { ...rest, products },
    { ...rest, suppliers },
    { ...validScenario(), version: 0 },
    { ...validScenario(), suppliers: [{ name: 'Sem id' }] },
    { ...validScenario(), products: [{ productId: 'not-an-id', offers: [validOffer()] }] },
    { ...validScenario(), products: [{ productId: PRODUCT_ID }] },
    withOffer({ supplierId: undefined }),
    withOffer({ priceEur: -1 }),
    withOffer({ stockUnits: 0 }),
    withOffer({ stockUnits: 1.5 }),
    withOffer({ leadTimeDays: -1 }),
    withOffer({ supplyLimit: -1 }),
  ];

  for (const body of invalidBodies) {
    const res = await request('POST', '/supplier-scenarios', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(scenarioRepo.create.mock.callCount(), 0);

  // supplyLimit is optional.
  const minimal = {
    name: 'Mínimo',
    suppliers: [{ id: 'SUP-2', name: 'Fornecedor B' }],
    products: [
      {
        productId: PRODUCT_ID,
        offers: [{ supplierId: 'SUP-2', priceEur: 0, stockUnits: 1, leadTimeDays: 0 }],
      },
    ],
  };
  const okRes = await request('POST', '/supplier-scenarios', minimal);
  assert.equal(okRes.status, 201);
  assert.equal(scenarioRepo.create.mock.callCount(), 1);
});

test('API /supplier-scenarios returns a complete list of all active scenarios', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  // The repository returns every scenario; the inactive one must be filtered out.
  scenarioRepo.list.mock.mockImplementation(async () => [
    { _id: SCENARIO_ID, ...validScenario(), name: 'Active', isActive: true },
    { _id: OTHER_SCENARIO_ID, ...validScenario(), name: 'Inactive', isActive: false },
  ]);

  const res = await request('GET', '/supplier-scenarios');
  assert.equal(res.status, 200);

  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.equal(
    list.some((s) => s.name === 'Inactive'),
    false,
  );
  assert.equal(
    list.some((s) => s.name === 'Active'),
    true,
  );
  assert.equal(scenarioRepo.list.mock.callCount(), 1);
});

test('API /supplier-scenarios filters by name', async (t) => {
  const { server, port, scenarioRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  scenarioRepo.search.mock.mockImplementation(async () => [
    { _id: SCENARIO_ID, ...validScenario(), isActive: true },
  ]);

  const res = await request('GET', '/supplier-scenarios?name=base');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, 1);
  assert.equal(scenarioRepo.search.mock.calls[0].arguments[0], 'base');
  assert.equal(scenarioRepo.list.mock.callCount(), 0);
});
