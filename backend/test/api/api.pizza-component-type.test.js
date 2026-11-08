import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const BASE_PATH = '/pizza-component-type';

// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';
const CHEESE_ID = 'abcdef000000000000000101';
const TOPPING_ID = 'abcdef000000000000000102';
const RECREATED_ID = 'abcdef000000000000000103';

const CHEESE = { name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 };
const TOPPING = { name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null };

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

const duplicateKeyError = (keyPattern) =>
  Object.assign(new Error('Duplicate Key'), { code: 11000, keyPattern });

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

async function login(port, identifier) {
  const res = await request(port, 'POST', '/auth/login', {
    body: { email: identifier, password: 'StrongPassword123!' },
  });
  return (await res.json()).accessToken;
}

async function setupTestServer() {
  // Nothing is stored until a test programs the answers of each step.
  const typesRepo = {
    create: mock.fn(async (data) => ({
      ...data,
      _id: CHEESE_ID,
      maxQuantity: data.maxQuantity ?? null,
      isActive: data.isActive ?? true,
    })),
    listPizzaComponentTypes: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    searchByName: mock.fn(async () => []),
    update: mock.fn(async () => null),
  };
  const productsRepo = { existsByPizzaComponentType: mock.fn(async () => false) };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    pizzaComponentTypesRepository: typesRepo,
    productsRepository: productsRepo,
  }).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  const managerToken = await login(port, 'admin@laprizza.pt');
  const employeeToken = await login(port, 'emp@laprizza.pt');

  return { server, port, managerToken, employeeToken, typesRepo, productsRepo };
}

function closeServer(server) {
  server.close();
  server.closeAllConnections();
}

/** Programs the repository with the stored types (findById and update work on them). */
function storeTypes(typesRepo, types) {
  const byId = (id) => types.find((type) => type._id === String(id)) ?? null;
  typesRepo.findById.mock.mockImplementation(async (id) => byId(id));
  typesRepo.update.mock.mockImplementation(async (id, data) =>
    byId(id) ? { ...byId(id), ...data } : null,
  );
}

const cheese = (extra = {}) => ({ _id: CHEESE_ID, ...CHEESE, isActive: true, ...extra });
const topping = (extra = {}) => ({ _id: TOPPING_ID, ...TOPPING, isActive: true, ...extra });

test('API /pizza-component-type (401 and 403)', async (t) => {
  const { server, port, employeeToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  const endpoints = [
    ['GET', BASE_PATH],
    ['POST', BASE_PATH],
    ['GET', `${BASE_PATH}/${NON_EXISTENT_ID}`],
    ['PUT', `${BASE_PATH}/${NON_EXISTENT_ID}`],
    ['DELETE', `${BASE_PATH}/${NON_EXISTENT_ID}`],
  ];

  for (const [method, path] of endpoints) {
    const body = method === 'POST' || method === 'PUT' ? CHEESE : undefined;

    assert.equal((await request(port, method, path, { body })).status, 401, `${method} ${path}`);
    assert.equal(
      (await request(port, method, path, { token: employeeToken, body })).status,
      403,
      `${method} ${path}`,
    );
  }

  // The repository is never reached
  for (const method of Object.values(typesRepo)) assert.equal(method.mock.callCount(), 0);
});

test('API POST /pizza-component-type (201)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  // 201 Created - normalized name, identifier exposed as 'id', active by default
  const created = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { ...CHEESE, name: '  Extra   Cheese ' },
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.ok(body.id);
  assert.equal(body.name, 'Extra Cheese');
  assert.equal(body.assemblyOrder, 3);
  assert.equal(body.minQuantity, 0);
  assert.equal(body.maxQuantity, 1);
  assert.equal(body.isActive, true);
  assert.equal(body._id, undefined);

  // 201 Created - an omitted or null maximum means unbounded
  const omitted = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { name: 'Topping', assemblyOrder: 4, minQuantity: 0 },
  });
  assert.equal(omitted.status, 201);
  assert.equal((await omitted.json()).maxQuantity, null);

  const explicitNull = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { name: 'Extras', assemblyOrder: 5, minQuantity: 0, maxQuantity: null },
  });
  assert.equal(explicitNull.status, 201);
  assert.equal((await explicitNull.json()).maxQuantity, null);

  // 201 Created - a minimum equal to the maximum is allowed
  const equal = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
  });
  assert.equal(equal.status, 201);

  assert.deepEqual(
    typesRepo.create.mock.calls.map((c) => c.arguments[0].maxQuantity),
    [1, null, null, 1],
  );
});

test('API POST /pizza-component-type ignores isActive sent by the client', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  const created = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { ...CHEESE, isActive: false, other: 'x' },
  });

  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.isActive, true);
  assert.equal(body.other, undefined);
  // Only the known fields reach the repository
  assert.deepEqual(typesRepo.create.mock.calls[0].arguments[0], CHEESE);
});

test('API POST /pizza-component-type (400)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  const invalidBodies = [
    {},
    { other: 'x' },
    { ...CHEESE, name: undefined },
    { ...CHEESE, name: '' },
    { ...CHEESE, name: '   ' },
    { ...CHEESE, name: 123 },
    { ...CHEESE, assemblyOrder: undefined },
    { ...CHEESE, assemblyOrder: 0 },
    { ...CHEESE, assemblyOrder: 1.5 },
    { ...CHEESE, assemblyOrder: '3' },
    { ...CHEESE, minQuantity: undefined },
    { ...CHEESE, minQuantity: -1 },
    { ...CHEESE, minQuantity: '0' },
    { ...CHEESE, maxQuantity: 0 },
    { ...CHEESE, maxQuantity: 1.5 },
    { ...CHEESE, maxQuantity: 'a' },
    { ...CHEESE, minQuantity: 2, maxQuantity: 1 },
  ];

  for (const invalidBody of invalidBodies) {
    assert.equal(
      (await request(port, 'POST', BASE_PATH, { token: managerToken, body: invalidBody })).status,
      400,
      JSON.stringify(invalidBody),
    );
  }

  // Nothing was saved
  assert.equal(typesRepo.create.mock.callCount(), 0);
});

test('API POST /pizza-component-type (409)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  // 409 Conflict - same name with a different case and without accents
  typesRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError({ name: 1 });
  });
  assert.equal(
    (
      await request(port, 'POST', BASE_PATH, {
        token: managerToken,
        body: { ...CHEESE, name: 'CAFE', assemblyOrder: 9 },
      })
    ).status,
    409,
  );

  // 409 Conflict - same assembly order
  typesRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError({ assemblyOrder: 1 });
  });
  assert.equal(
    (
      await request(port, 'POST', BASE_PATH, {
        token: managerToken,
        body: { ...TOPPING, assemblyOrder: 3 },
      })
    ).status,
    409,
  );
});

test('API GET /pizza-component-type (list and search)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  const cafe = cheese({ name: 'Café' });
  // The repository returns the active types sorted by assembly order
  typesRepo.listPizzaComponentTypes.mock.mockImplementation(async () => [cafe, topping()]);
  typesRepo.searchByName.mock.mockImplementation(async (name) => (name === 'cafe' ? [cafe] : []));

  const all = await request(port, 'GET', BASE_PATH, { token: managerToken });
  assert.equal(all.status, 200);
  const allBody = await all.json();
  assert.deepEqual(
    allBody.map((type) => type.name),
    ['Café', 'Topping'],
  );
  assert.ok(allBody[0].id);
  assert.equal(allBody[0]._id, undefined);

  const exact = await request(port, 'GET', `${BASE_PATH}?name=cafe`, { token: managerToken });
  assert.equal(exact.status, 200);
  const exactBody = await exact.json();
  assert.equal(exactBody.length, 1);
  assert.equal(exactBody[0].name, 'Café');

  for (const query of ['?name=caf', '?name=nothing', '?name=']) {
    const res = await request(port, 'GET', `${BASE_PATH}${query}`, { token: managerToken });
    assert.equal(res.status, 200, query);
    assert.deepEqual(await res.json(), [], query);
  }
  assert.equal(typesRepo.searchByName.mock.calls[0].arguments[0], 'cafe');
});

test('API GET /pizza-component-type/:id (400, 404, 200)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese()]);

  assert.equal(
    (await request(port, 'GET', `${BASE_PATH}/id_invalido`, { token: managerToken })).status,
    400,
  );
  assert.equal(
    (await request(port, 'GET', `${BASE_PATH}/${NON_EXISTENT_ID}`, { token: managerToken })).status,
    404,
  );

  const res = await request(port, 'GET', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: CHEESE_ID, ...CHEESE, isActive: true });
  assert.deepEqual(
    typesRepo.findById.mock.calls.map((c) => c.arguments[0]),
    [NON_EXISTENT_ID, CHEESE_ID],
  );
});

test('API PUT /pizza-component-type/:id (200)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese()]);

  const ok = await request(port, 'PUT', `${BASE_PATH}/${CHEESE_ID}`, {
    token: managerToken,
    body: { name: '  Extra   Cheese ', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), {
    id: CHEESE_ID,
    name: 'Extra Cheese',
    assemblyOrder: 7,
    minQuantity: 1,
    maxQuantity: null,
    isActive: true,
  });
  assert.deepEqual(typesRepo.update.mock.calls[0].arguments, [
    CHEESE_ID,
    { name: 'Extra Cheese', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  ]);

  // The type keeps its own values and name, only the case changes
  storeTypes(typesRepo, [
    cheese({ name: 'Extra Cheese', assemblyOrder: 7, minQuantity: 1, maxQuantity: null }),
  ]);
  const sameValues = await request(port, 'PUT', `${BASE_PATH}/${CHEESE_ID}`, {
    token: managerToken,
    body: { name: 'extra cheese', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  });
  assert.equal(sameValues.status, 200);
});

test('API PUT /pizza-component-type/:id cannot deactivate the type', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese()]);

  const res = await request(port, 'PUT', `${BASE_PATH}/${CHEESE_ID}`, {
    token: managerToken,
    body: { ...CHEESE, isActive: false },
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).isActive, true);
  assert.equal(typesRepo.update.mock.calls[0].arguments[1].isActive, undefined);
});

test('API PUT /pizza-component-type/:id (400, 404, 409)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese(), topping()]);

  // 400 Bad Request - invalid ID format
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/id_invalido`, {
        token: managerToken,
        body: TOPPING,
      })
    ).status,
    400,
  );

  // 400 Bad Request - empty body, blank name and maximum lower than the minimum
  for (const invalidBody of [
    {},
    { ...TOPPING, name: '   ' },
    { ...TOPPING, minQuantity: 5, maxQuantity: 2 },
  ]) {
    assert.equal(
      (
        await request(port, 'PUT', `${BASE_PATH}/${TOPPING_ID}`, {
          token: managerToken,
          body: invalidBody,
        })
      ).status,
      400,
      JSON.stringify(invalidBody),
    );
  }
  assert.equal(typesRepo.update.mock.callCount(), 0);

  // 404 Not Found
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${NON_EXISTENT_ID}`, {
        token: managerToken,
        body: TOPPING,
      })
    ).status,
    404,
  );

  // 409 Conflict - name of another type, with a different case
  typesRepo.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError({ name: 1 });
  });
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${TOPPING_ID}`, {
        token: managerToken,
        body: { ...TOPPING, name: 'CHEESE' },
      })
    ).status,
    409,
  );

  // 409 Conflict - assembly order of another type
  typesRepo.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError({ assemblyOrder: 1 });
  });
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${TOPPING_ID}`, {
        token: managerToken,
        body: { ...TOPPING, assemblyOrder: 3 },
      })
    ).status,
    409,
  );
});

test('API DELETE /pizza-component-type/:id (400, 404, 204)', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese()]);

  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/id_invalido`, { token: managerToken })).status,
    400,
  );
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${NON_EXISTENT_ID}`, { token: managerToken }))
      .status,
    404,
  );

  const removed = await request(port, 'DELETE', `${BASE_PATH}/${CHEESE_ID}`, {
    token: managerToken,
  });
  assert.equal(removed.status, 204);
  assert.deepEqual(typesRepo.update.mock.calls[0].arguments, [CHEESE_ID, { isActive: false }]);

  // 404 Not Found - the type was already removed
  storeTypes(typesRepo, [cheese({ isActive: false })]);
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken })).status,
    404,
  );
  assert.equal(typesRepo.update.mock.callCount(), 1);
});

test('API DELETE /pizza-component-type/:id is a soft delete', async (t) => {
  const { server, port, managerToken, typesRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese(), topping()]);

  await request(port, 'DELETE', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken });
  // The type is deactivated, never deleted
  assert.deepEqual(typesRepo.update.mock.calls[0].arguments, [CHEESE_ID, { isActive: false }]);

  // Step: the cheese type is now inactive.
  const removed = cheese({ isActive: false });
  storeTypes(typesRepo, [removed, topping()]);
  typesRepo.listPizzaComponentTypes.mock.mockImplementation(async () => [topping()]);
  typesRepo.searchByName.mock.mockImplementation(async () => [removed]);

  // It disappears from the list...
  const list = await request(port, 'GET', BASE_PATH, { token: managerToken });
  assert.deepEqual(
    (await list.json()).map((type) => type.name),
    ['Topping'],
  );

  // ...but can still be found by ID and by name, flagged as inactive
  const byId = await request(port, 'GET', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken });
  assert.equal(byId.status, 200);
  assert.equal((await byId.json()).isActive, false);

  const byName = await request(port, 'GET', `${BASE_PATH}?name=cheese`, { token: managerToken });
  assert.equal(byName.status, 200);
  const byNameBody = await byName.json();
  assert.equal(byNameBody.length, 1);
  assert.equal(byNameBody[0].isActive, false);

  // It cannot be updated
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${CHEESE_ID}`, {
        token: managerToken,
        body: { ...CHEESE, name: 'Other' },
      })
    ).status,
    404,
  );
  assert.equal(typesRepo.update.mock.callCount(), 1);

  // Its name and assembly order can be used again (a new type is created)
  typesRepo.create.mock.mockImplementationOnce(async (data) => ({
    ...data,
    _id: RECREATED_ID,
    isActive: true,
  }));
  const recreated = await request(port, 'POST', BASE_PATH, { token: managerToken, body: CHEESE });
  assert.equal(recreated.status, 201);
  assert.notEqual((await recreated.json()).id, CHEESE_ID);
});

test('API DELETE /pizza-component-type/:id (409)', async (t) => {
  const { server, port, managerToken, typesRepo, productsRepo } = await setupTestServer();

  t.after(() => closeServer(server));

  storeTypes(typesRepo, [cheese(), topping()]);
  typesRepo.listPizzaComponentTypes.mock.mockImplementation(async () => [cheese(), topping()]);
  // An active product references the cheese type
  productsRepo.existsByPizzaComponentType.mock.mockImplementation(async (id) => id === CHEESE_ID);

  // 409 Conflict - an active product references the type
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken })).status,
    409,
  );
  assert.equal(typesRepo.update.mock.callCount(), 0);

  // The type is still active and keeps being listed
  const byId = await request(port, 'GET', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken });
  assert.equal((await byId.json()).isActive, true);
  const list = await request(port, 'GET', BASE_PATH, { token: managerToken });
  assert.deepEqual(
    (await list.json()).map((type) => type.name),
    ['Cheese', 'Topping'],
  );

  // 204 No Content - a type that no product references can be removed
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${TOPPING_ID}`, { token: managerToken })).status,
    204,
  );

  // 204 No Content - an inactive product does not block the removal
  productsRepo.existsByPizzaComponentType.mock.mockImplementation(async () => false);
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${CHEESE_ID}`, { token: managerToken })).status,
    204,
  );
  assert.deepEqual(
    typesRepo.update.mock.calls.map((c) => c.arguments[0]),
    [TOPPING_ID, CHEESE_ID],
  );
});
