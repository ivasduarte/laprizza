import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';
const PIZZAS_ID = 'abcdef000000000000000101';
const DRINKS_ID = 'abcdef000000000000000102';
const NEW_PIZZAS_ID = 'abcdef000000000000000103';

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

const duplicateKeyError = () => Object.assign(new Error('Duplicate Key'), { code: 11000 });

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
  const categoriesRepo = {
    listProductCategories: mock.fn(async () => []),
    searchByName: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: PIZZAS_ID, ...data, isActive: true })),
    update: mock.fn(async () => null),
  };
  const productsRepo = { existsByCategory: mock.fn(async () => false) };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    productCategoriesRepository: categoriesRepo,
    productsRepository: productsRepo,
  }).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  const managerToken = await login(port, 'admin@laprizza.pt');
  const employeeToken = await login(port, 'emp@laprizza.pt');

  return { server, port, managerToken, employeeToken, categoriesRepo, productsRepo };
}

/** Programs the repository with the stored categories (findById and update work on them). */
function storeCategories(categoriesRepo, categories) {
  const byId = (id) => categories.find((c) => c._id === String(id)) ?? null;
  categoriesRepo.findById.mock.mockImplementation(async (id) => byId(id));
  categoriesRepo.update.mock.mockImplementation(async (id, data) =>
    byId(id) ? { ...byId(id), ...data } : null,
  );
}

test('API /product-categories (401 and 403)', async (t) => {
  const { server, port, employeeToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const endpoints = [
    ['GET', '/product-categories'],
    ['POST', '/product-categories'],
    ['GET', `/product-categories/${NON_EXISTENT_ID}`],
    ['PUT', `/product-categories/${NON_EXISTENT_ID}`],
    ['DELETE', `/product-categories/${NON_EXISTENT_ID}`],
  ];

  for (const [method, path] of endpoints) {
    const body = method === 'POST' || method === 'PUT' ? { name: 'Pizzas' } : undefined;

    assert.equal((await request(port, method, path, { body })).status, 401, `${method} ${path}`);
    assert.equal(
      (await request(port, method, path, { token: employeeToken, body })).status,
      403,
      `${method} ${path}`,
    );
  }

  // The repository is never reached
  for (const method of Object.values(categoriesRepo)) assert.equal(method.mock.callCount(), 0);
});

test('API POST /product-categories (201, 400, 409)', async (t) => {
  const { server, port, managerToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  // 201 Created - normalized name, identifier exposed as 'id'
  const created = await request(port, 'POST', '/product-categories', {
    token: managerToken,
    body: { name: '  Soft   Drinks ' },
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.ok(body.id);
  assert.equal(body.name, 'Soft Drinks');
  assert.equal(body._id, undefined);
  assert.deepEqual(categoriesRepo.create.mock.calls[0].arguments[0], { name: 'Soft Drinks' });

  // 400 Bad Request - missing, blank and non-text name
  for (const invalidBody of [{}, { name: '' }, { name: '   ' }, { name: 123 }, { other: 'x' }]) {
    assert.equal(
      (await request(port, 'POST', '/product-categories', { token: managerToken, body: invalidBody }))
        .status,
      400,
      JSON.stringify(invalidBody),
    );
  }
  assert.equal(categoriesRepo.create.mock.callCount(), 1);

  // 409 Conflict - same name with a different case (rejected by the unique index)
  categoriesRepo.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError();
  });
  assert.equal(
    (
      await request(port, 'POST', '/product-categories', {
        token: managerToken,
        body: { name: 'SOFT DRINKS' },
      })
    ).status,
    409,
  );
});

test('API GET /product-categories (list and search)', async (t) => {
  const { server, port, managerToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const cafe = { _id: PIZZAS_ID, name: 'Café', isActive: true };
  categoriesRepo.listProductCategories.mock.mockImplementation(async () => [
    cafe,
    { _id: DRINKS_ID, name: 'Pizzas', isActive: true },
  ]);
  // Exact match ignoring case and accents; anything else finds nothing.
  categoriesRepo.searchByName.mock.mockImplementation(async (name) => (name === 'cafe' ? [cafe] : []));

  const all = await request(port, 'GET', '/product-categories', { token: managerToken });
  assert.equal(all.status, 200);
  assert.equal((await all.json()).length, 2);

  const exact = await request(port, 'GET', '/product-categories?name=cafe', { token: managerToken });
  assert.equal(exact.status, 200);
  const exactBody = await exact.json();
  assert.equal(exactBody.length, 1);
  assert.equal(exactBody[0].name, 'Café');

  for (const query of ['?name=caf', '?name=nothing', '?name=']) {
    const res = await request(port, 'GET', `/product-categories${query}`, { token: managerToken });
    assert.equal(res.status, 200, query);
    assert.deepEqual(await res.json(), [], query);
  }
  assert.equal(categoriesRepo.listProductCategories.mock.callCount(), 1);
  assert.equal(categoriesRepo.searchByName.mock.calls[0].arguments[0], 'cafe');
});

test('API GET /product-categories/:id (400, 404, 200)', async (t) => {
  const { server, port, managerToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const created = await (
    await request(port, 'POST', '/product-categories', {
      token: managerToken,
      body: { name: 'Pizzas' },
    })
  ).json();
  storeCategories(categoriesRepo, [{ _id: created.id, name: 'Pizzas', isActive: true }]);

  assert.equal(
    (await request(port, 'GET', '/product-categories/id_invalido', { token: managerToken })).status,
    400,
  );
  assert.equal(
    (await request(port, 'GET', `/product-categories/${NON_EXISTENT_ID}`, { token: managerToken }))
      .status,
    404,
  );

  const res = await request(port, 'GET', `/product-categories/${created.id}`, {
    token: managerToken,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: created.id, name: 'Pizzas', isActive: true });
  // The invalid identifier never reaches the repository
  assert.deepEqual(
    categoriesRepo.findById.mock.calls.map((c) => c.arguments[0]),
    [NON_EXISTENT_ID, created.id],
  );
});

test('API PUT /product-categories/:id (200, 400, 404, 409)', async (t) => {
  const { server, port, managerToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  storeCategories(categoriesRepo, [
    { _id: PIZZAS_ID, name: 'Pizzas', isActive: true },
    { _id: DRINKS_ID, name: 'Bebidas', isActive: true },
  ]);
  const drinks = { id: DRINKS_ID };

  // 200 OK
  const ok = await request(port, 'PUT', `/product-categories/${drinks.id}`, {
    token: managerToken,
    body: { name: 'Soft Drinks' },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { id: drinks.id, name: 'Soft Drinks', isActive: true });
  assert.deepEqual(categoriesRepo.update.mock.calls[0].arguments, [DRINKS_ID, { name: 'Soft Drinks' }]);

  // 400 Bad Request - invalid ID format, empty body and blank name
  assert.equal(
    (
      await request(port, 'PUT', '/product-categories/id_invalido', {
        token: managerToken,
        body: { name: 'X' },
      })
    ).status,
    400,
  );
  for (const invalidBody of [{}, { name: '' }, { name: '   ' }]) {
    assert.equal(
      (
        await request(port, 'PUT', `/product-categories/${drinks.id}`, {
          token: managerToken,
          body: invalidBody,
        })
      ).status,
      400,
      JSON.stringify(invalidBody),
    );
  }
  assert.equal(categoriesRepo.update.mock.callCount(), 1);

  // 404 Not Found
  assert.equal(
    (
      await request(port, 'PUT', `/product-categories/${NON_EXISTENT_ID}`, {
        token: managerToken,
        body: { name: 'Qualquer' },
      })
    ).status,
    404,
  );

  // 409 Conflict - name of another category, with a different case
  categoriesRepo.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError();
  });
  assert.equal(
    (
      await request(port, 'PUT', `/product-categories/${drinks.id}`, {
        token: managerToken,
        body: { name: 'PIZZAS' },
      })
    ).status,
    409,
  );
});

test('API DELETE /product-categories/:id (400, 404, 409, 204)', async (t) => {
  const { server, port, managerToken, categoriesRepo, productsRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const pizzas = { _id: PIZZAS_ID, name: 'Pizzas', isActive: true };
  const drinks = { _id: DRINKS_ID, name: 'Bebidas', isActive: true };
  storeCategories(categoriesRepo, [pizzas, drinks]);

  // 400 Bad Request - invalid ID format
  assert.equal(
    (await request(port, 'DELETE', '/product-categories/id_invalido', { token: managerToken })).status,
    400,
  );

  // 404 Not Found
  assert.equal(
    (await request(port, 'DELETE', `/product-categories/${NON_EXISTENT_ID}`, { token: managerToken }))
      .status,
    404,
  );

  // 409 Conflict - referenced by an active product
  productsRepo.existsByCategory.mock.mockImplementation(async (id) => id === DRINKS_ID);
  assert.equal(
    (await request(port, 'DELETE', `/product-categories/${drinks._id}`, { token: managerToken })).status,
    409,
  );
  assert.equal(categoriesRepo.update.mock.callCount(), 0);

  // 204 No Content - the category becomes inactive
  assert.equal(
    (await request(port, 'DELETE', `/product-categories/${pizzas._id}`, { token: managerToken })).status,
    204,
  );
  assert.deepEqual(categoriesRepo.update.mock.calls[0].arguments, [PIZZAS_ID, { isActive: false }]);

  // 404 Not Found - already removed
  storeCategories(categoriesRepo, [{ ...pizzas, isActive: false }, drinks]);
  assert.equal(
    (await request(port, 'DELETE', `/product-categories/${pizzas._id}`, { token: managerToken })).status,
    404,
  );
  assert.equal(categoriesRepo.update.mock.callCount(), 1); // not deactivated again
});

test('API inactive category (list, search, get, update, reuse of the name)', async (t) => {
  const { server, port, managerToken, categoriesRepo } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const inactive = { _id: PIZZAS_ID, name: 'Pizzas', isActive: false };
  const drinks = { _id: DRINKS_ID, name: 'Bebidas', isActive: true };
  storeCategories(categoriesRepo, [inactive, drinks]);
  categoriesRepo.listProductCategories.mock.mockImplementation(async () => [drinks]);
  categoriesRepo.searchByName.mock.mockImplementation(async () => [inactive]);

  // GET without name - only the active categories
  const list = await (await request(port, 'GET', '/product-categories', { token: managerToken })).json();
  assert.deepEqual(
    list.map((c) => c.name),
    ['Bebidas'],
  );

  // GET with name - the inactive category can be found
  const search = await (
    await request(port, 'GET', '/product-categories?name=pizzas', { token: managerToken })
  ).json();
  assert.equal(search.length, 1);
  assert.equal(search[0].isActive, false);

  // GET by id - the inactive category can be consulted
  const byId = await request(port, 'GET', `/product-categories/${inactive._id}`, { token: managerToken });
  assert.equal(byId.status, 200);
  assert.equal((await byId.json()).isActive, false);

  // PUT - an inactive category cannot be updated
  assert.equal(
    (
      await request(port, 'PUT', `/product-categories/${inactive._id}`, {
        token: managerToken,
        body: { name: 'Outro' },
      })
    ).status,
    409,
  );
  assert.equal(categoriesRepo.update.mock.callCount(), 0);

  // POST - the name of an inactive category can be reused (a new category is created)
  categoriesRepo.create.mock.mockImplementationOnce(async (data) => ({
    _id: NEW_PIZZAS_ID,
    ...data,
    isActive: true,
  }));
  const again = await request(port, 'POST', '/product-categories', {
    token: managerToken,
    body: { name: 'Pizzas' },
  });
  assert.equal(again.status, 201);
  assert.notEqual((await again.json()).id, inactive._id);
});
