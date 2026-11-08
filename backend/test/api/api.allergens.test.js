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

const ALLERGEN_ID = 'a11e12000000000000000001';
const OTHER_ALLERGEN_ID = 'a11e12000000000000000002';

const duplicateKeyError = () =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { name: 1 } });

async function setupTestServer() {
  // Nothing is stored until a test programs the answers of each step.
  const allergenRepo = {
    list: mock.fn(async () => []),
    search: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    findByName: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: ALLERGEN_ID, ...data })),
    update: mock.fn(async (id, data) => ({ _id: id, name: 'Allergen', isActive: true, ...data })),
    isReferenced: mock.fn(async () => false),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    allergenRepository: allergenRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, allergenRepo };
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

test('API /allergens RBAC: Only MANAGER can create and update', async (t) => {
  const { server, port, allergenRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/allergens', { name: 'Gluten' });
  assert.equal(postEmp.status, 403);
  assert.equal(allergenRepo.create.mock.callCount(), 0);

  const postMgr = await managerRequest('POST', '/allergens', { name: 'Gluten' });
  assert.equal(postMgr.status, 201);
  assert.equal(allergenRepo.create.mock.callCount(), 1);
});

test('API /allergens lifecycle and validations', async (t) => {
  const { server, port, allergenRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postBad = await request('POST', '/allergens', {});
  assert.equal(postBad.status, 400);
  assert.equal(allergenRepo.create.mock.callCount(), 0);

  const postRes = await request('POST', '/allergens', { name: 'Amendoim' });
  assert.equal(postRes.status, 201);
  const { id } = await postRes.json();
  assert.equal(id, ALLERGEN_ID);

  // Step: the name is now taken.
  allergenRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError();
  });
  const postDup = await request('POST', '/allergens', { name: 'amendoim' });
  assert.equal(postDup.status, 409);

  // Step: the allergen exists and is active.
  const stored = { _id: ALLERGEN_ID, name: 'Amendoim', isActive: true };
  allergenRepo.findById.mock.mockImplementation(async (allergenId) =>
    allergenId === ALLERGEN_ID ? stored : null,
  );
  allergenRepo.findByName.mock.mockImplementation(async () => stored);

  const getRes = await request('GET', `/allergens/${id}`);
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).name, 'Amendoim');

  const getNameRes = await request('GET', `/allergens/name/Amendoim`);
  assert.equal(getNameRes.status, 200);
  assert.equal(allergenRepo.findByName.mock.calls[0].arguments[0], 'Amendoim');

  const putBad = await request('PUT', `/allergens/${id}`, { name: 'Outro' });
  assert.equal(putBad.status, 400);

  const putDeactivate = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);
  assert.deepEqual(allergenRepo.update.mock.calls[0].arguments, [ALLERGEN_ID, { isActive: false }]);

  // Step: the allergen is now inactive.
  allergenRepo.findById.mock.mockImplementation(async () => ({ ...stored, isActive: false }));
  const getDeactivated = await request('GET', `/allergens/${id}`);
  assert.equal(getDeactivated.status, 404);
});

test('API /allergens prevents deactivation if referenced', async (t) => {
  const { server, port, allergenRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postRes = await request('POST', '/allergens', { name: 'Lactose' });
  const { id } = await postRes.json();

  allergenRepo.findById.mock.mockImplementation(async () => ({
    _id: ALLERGEN_ID,
    name: 'Lactose',
    isActive: true,
  }));
  allergenRepo.isReferenced.mock.mockImplementation(async () => true);

  const putDeactivate = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 409);

  const responseBody = await putDeactivate.json();
  assert.ok(responseBody.error.message.includes('referenced'));
  assert.equal(allergenRepo.isReferenced.mock.calls[0].arguments[0], id);
  assert.equal(allergenRepo.update.mock.callCount(), 0);

  allergenRepo.isReferenced.mock.mockImplementation(async () => false);
  const putDeactivateSuccess = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivateSuccess.status, 200);
  assert.equal(allergenRepo.update.mock.callCount(), 1);
});

test('API /allergens returns a complete list of all active allergens', async (t) => {
  const { server, port, allergenRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  // The repository returns every allergen; the inactive one must be filtered out.
  allergenRepo.list.mock.mockImplementation(async () => [
    { _id: ALLERGEN_ID, name: 'Peanut', isActive: true },
    { _id: OTHER_ALLERGEN_ID, name: 'Mustard', isActive: false },
  ]);

  const res = await request('GET', '/allergens');
  assert.equal(res.status, 200);

  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);

  const hasMustard = list.some((a) => a.name === 'Mustard');
  assert.equal(hasMustard, false);

  const hasPeanut = list.some((a) => a.name === 'Peanut');
  assert.equal(hasPeanut, true);
  assert.equal(allergenRepo.list.mock.callCount(), 1);
});
