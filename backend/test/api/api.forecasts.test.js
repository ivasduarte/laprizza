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

const FORECAST_ID = 'f0ca57000000000000000001';
const OTHER_FORECAST_ID = 'f0ca57000000000000000002';
const PRODUCT_ID = 'd0d0c7000000000000000001';
const SIZE_ID = '512e00000000000000000001';

const duplicateKeyError = () =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { name: 1 } });

const validForecast = () => ({
  name: 'Forecast Novembro',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  entries: [{ date: '2026-11-01', productId: PRODUCT_ID, sizeId: SIZE_ID, quantity: 10 }],
});

async function setupTestServer() {
  // Nothing is stored until a test programs the answers of each step.
  const forecastRepo = {
    list: mock.fn(async () => []),
    search: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: FORECAST_ID, ...data })),
    update: mock.fn(async (id, data) => ({ _id: id, ...validForecast(), isActive: true, ...data })),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    forecastRepository: forecastRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, forecastRepo };
}

test('API /forecasts RBAC: Only MANAGER can create and update', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/forecasts', validForecast());
  assert.equal(postEmp.status, 403);
  assert.equal(forecastRepo.create.mock.callCount(), 0);

  const putEmp = await empRequest('PUT', `/forecasts/${FORECAST_ID}`, { isActive: false });
  assert.equal(putEmp.status, 403);
  assert.equal(forecastRepo.update.mock.callCount(), 0);

  const postMgr = await managerRequest('POST', '/forecasts', validForecast());
  assert.equal(postMgr.status, 201);
  assert.equal(forecastRepo.create.mock.callCount(), 1);
});

test('API /forecasts EMPLOYEE cannot read (MANAGER only)', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await empRequest('GET', '/forecasts')).status, 403);
  assert.equal((await empRequest('GET', `/forecasts/${FORECAST_ID}`)).status, 403);
  assert.equal(forecastRepo.list.mock.callCount(), 0);
  assert.equal(forecastRepo.findById.mock.callCount(), 0);
});

test('API /forecasts requires authentication', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const res = await fetch(`http://127.0.0.1:${port}/api/v1/forecasts`);
  assert.equal(res.status, 401);
});

test('API /forecasts lifecycle and validations', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postBad = await request('POST', '/forecasts', {});
  assert.equal(postBad.status, 400);
  assert.equal(forecastRepo.create.mock.callCount(), 0);

  const postRes = await request('POST', '/forecasts', validForecast());
  assert.equal(postRes.status, 201);
  const { id } = await postRes.json();
  assert.equal(id, FORECAST_ID);

  // Unknown fields are stripped before reaching the repository.
  const postExtra = await request('POST', '/forecasts', { ...validForecast(), hacker: true });
  assert.equal(postExtra.status, 201);
  const stored = forecastRepo.create.mock.calls[1].arguments[0];
  assert.equal(stored.hacker, undefined);
  assert.equal(stored.isActive, true);

  // Step: the name is now taken.
  forecastRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError();
  });
  const postDup = await request('POST', '/forecasts', validForecast());
  assert.equal(postDup.status, 409);

  // Step: the forecast exists and is active.
  const storedForecast = { _id: FORECAST_ID, ...validForecast(), isActive: true };
  forecastRepo.findById.mock.mockImplementation(async (forecastId) =>
    forecastId === FORECAST_ID ? storedForecast : null,
  );

  const getRes = await request('GET', `/forecasts/${id}`);
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).name, 'Forecast Novembro');

  const getMissing = await request('GET', `/forecasts/${OTHER_FORECAST_ID}`);
  assert.equal(getMissing.status, 404);

  const getBadId = await request('GET', '/forecasts/not-an-id');
  assert.equal(getBadId.status, 400);

  const putBad = await request('PUT', `/forecasts/${id}`, { name: 'Outro' });
  assert.equal(putBad.status, 400);

  const putActive = await request('PUT', `/forecasts/${id}`, { isActive: true });
  assert.equal(putActive.status, 400);

  const putDeactivate = await request('PUT', `/forecasts/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);
  assert.deepEqual(forecastRepo.update.mock.calls[0].arguments, [FORECAST_ID, { isActive: false }]);

  // Step: the forecast is now inactive.
  forecastRepo.findById.mock.mockImplementation(async () => ({
    ...storedForecast,
    isActive: false,
  }));
  const getDeactivated = await request('GET', `/forecasts/${id}`);
  assert.equal(getDeactivated.status, 404);
});

test('API /forecasts validates body fields', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const { entries, ...withoutEntries } = validForecast();
  const invalidBodies = [
    { ...validForecast(), name: '' },
    { ...validForecast(), startDate: undefined },
    { ...validForecast(), endDate: undefined },
    withoutEntries,
    { ...validForecast(), version: 0 },
    { ...validForecast(), entries: [{ ...entries[0], productId: 'not-an-id' }] },
    { ...validForecast(), entries: [{ ...entries[0], quantity: -1 }] },
    { ...validForecast(), entries: [{ ...entries[0], quantity: 1.5 }] },
    { ...validForecast(), entries: [{ ...entries[0], date: undefined }] },
  ];

  for (const body of invalidBodies) {
    const res = await request('POST', '/forecasts', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(forecastRepo.create.mock.callCount(), 0);

  // sizeId is optional and may be null.
  const nullSize = {
    ...validForecast(),
    entries: [{ date: '2026-11-01', productId: PRODUCT_ID, sizeId: null, quantity: 0 }],
  };
  const okRes = await request('POST', '/forecasts', nullSize);
  assert.equal(okRes.status, 201);
  assert.equal(forecastRepo.create.mock.callCount(), 1);
});

test('API /forecasts returns a complete list of all active forecasts', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  // The repository returns every forecast; the inactive one must be filtered out.
  forecastRepo.list.mock.mockImplementation(async () => [
    { _id: FORECAST_ID, ...validForecast(), name: 'Active', isActive: true },
    { _id: OTHER_FORECAST_ID, ...validForecast(), name: 'Inactive', isActive: false },
  ]);

  const res = await request('GET', '/forecasts');
  assert.equal(res.status, 200);

  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.equal(
    list.some((f) => f.name === 'Inactive'),
    false,
  );
  assert.equal(
    list.some((f) => f.name === 'Active'),
    true,
  );
  assert.equal(forecastRepo.list.mock.callCount(), 1);
});

test('API /forecasts filters by name', async (t) => {
  const { server, port, forecastRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  forecastRepo.search.mock.mockImplementation(async () => [
    { _id: FORECAST_ID, ...validForecast(), isActive: true },
  ]);

  const res = await request('GET', '/forecasts?name=novembro');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, 1);
  assert.equal(forecastRepo.search.mock.calls[0].arguments[0], 'novembro');
  assert.equal(forecastRepo.list.mock.callCount(), 0);
});
