import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const NON_EXISTENT_ID = 'abcdef000000000000000999';
const CATEGORY_ID = 'abcdef000000000000000101';
const TYPE_ID = 'abcdef000000000000000201';
const PRODUCT_ID = 'e0e0e0000000000000000001';
const SIZE_ID = 'd0d0d0000000000000000001';

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

async function setupTestServer() {
  const categoriesRepo = {
    findById: mock.fn(async (id) =>
      String(id) === CATEGORY_ID ? { _id: CATEGORY_ID, name: 'Bebidas', isActive: true } : null,
    ),
  };
  // No product exists until a test programs one.
  const productsRepo = {
    listProducts: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    findByName: mock.fn(async () => null),
    create: mock.fn(async (data) => ({
      _id: PRODUCT_ID,
      isActive: true,
      pizzaComponentTypeId: null,
      allergenIds: [],
      sizeConfigurations: [],
      ...data,
    })),
    update: mock.fn(async () => null),
    addSizeConfiguration: mock.fn(async () => null),
    removeSizeConfiguration: mock.fn(async () => null),
  };
  const allergensRepo = { findById: mock.fn(async () => null) };
  const typesRepo = { findById: mock.fn(async () => null) };
  const stockRepo = { create: mock.fn(async (data) => ({ _id: 'f0f0f0000000000000000001', ...data })) };
  const sizeRepo = { findById: mock.fn(async () => null) };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    productsRepository: productsRepo,
    allergensRepository: allergensRepo,
    categoriesRepository: categoriesRepo,
    productCategoriesRepository: categoriesRepo,
    pizzaComponentTypesRepository: typesRepo,
    pizzaComponentTypeRepository: typesRepo,
    stockRepository: stockRepo,
    sizeRepository: sizeRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return {
    server,
    port,
    productsRepo,
    categoriesRepo,
    typesRepo,
    stockRepo,
    sizeRepo,
    catId: CATEGORY_ID,
  };
}

/** Programs the products repository so that `product` is the stored product. */
function storeProduct(productsRepo, product) {
  productsRepo.findById.mock.mockImplementation(async (id) =>
    String(id) === product._id ? product : null,
  );
  productsRepo.update.mock.mockImplementation(async (_id, data) => ({ ...product, ...data }));
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

test('API /products RBAC: 401 Sem Token e 403 Funcionário a tentar Criar/Editar', async (t) => {
  const { server, port, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empToken = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await request(port, 'GET', '/products')).status, 401);
  assert.equal((await request(port, 'POST', '/products')).status, 401);

  assert.equal(
    (await request(port, 'POST', '/products', { token: empToken, body: {} })).status,
    403,
  );
  assert.equal(
    (await request(port, 'PATCH', `/products/${NON_EXISTENT_ID}`, { token: empToken, body: {} }))
      .status,
    403,
  );

  assert.equal(productsRepo.create.mock.callCount(), 0);
  assert.equal(productsRepo.update.mock.callCount(), 0);

  assert.equal((await request(port, 'GET', '/products', { token: empToken })).status, 200);
  assert.equal(productsRepo.listProducts.mock.callCount(), 1);
});

test('API POST /products Joi e Respostas', async (t) => {
  const { server, port, catId, productsRepo, stockRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const validPayload = {
    name: 'Água',
    description: 'Água lisa',
    price: 1,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  assert.equal(
    (
      await request(port, 'POST', '/products', {
        token: adminToken,
        body: { name: 'X', description: 'Y', stockControlled: true, categoryId: catId },
      })
    ).status,
    400,
  );

  assert.equal(
    (
      await request(port, 'POST', '/products', {
        token: adminToken,
        body: { ...validPayload, categoryId: 'abc' },
      })
    ).status,
    400,
  );

  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: validPayload,
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.equal(createdBody.name, 'Água');
  assert.equal(productsRepo.create.mock.callCount(), 1); // the invalid payloads never reached it
  assert.deepEqual(stockRepo.create.mock.calls[0].arguments[0], { productId: PRODUCT_ID, quantity: 0 });
});

test('API POST /products returns 409 for duplicate product name', async (t) => {
  const { server, port, catId, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const payload = {
    name: 'Sumo Laranja',
    description: 'Sumo natural',
    price: 2.5,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  const res1 = await request(port, 'POST', '/products', { token: adminToken, body: payload });
  assert.equal(res1.status, 201);

  // Step: a product with this name now exists.
  productsRepo.findByName.mock.mockImplementation(async () => ({ _id: PRODUCT_ID, ...payload }));
  const res2 = await request(port, 'POST', '/products', { token: adminToken, body: payload });
  assert.equal(res2.status, 409);
  assert.equal(productsRepo.findByName.mock.calls[1].arguments[0], 'Sumo Laranja');
  assert.equal(productsRepo.create.mock.callCount(), 1);
});

test('API POST /products Joi validates allergens and pizza component types', async (t) => {
  const { server, port, catId, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const validPayload = {
    name: 'Pizza',
    description: 'Teste',
    price: 1,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  const resDup = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      ...validPayload,
      allergenIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'],
    },
  });
  assert.equal(resDup.status, 400);

  const resFormat = await request(port, 'POST', '/products', {
    token: adminToken,
    body: { ...validPayload, pizzaComponentTypeId: 'formato_invalido_123' },
  });
  assert.equal(resFormat.status, 400);
  assert.equal(productsRepo.create.mock.callCount(), 0);
});

test('API GET e PATCH /products/:id Atualizações Parciais', async (t) => {
  const { server, port, catId, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      name: 'Pizza',
      description: 'Teste',
      price: 10,
      sellable: true,
      stockControlled: true,
      categoryId: catId,
    },
  });
  const id = (await createRes.json()).id;
  storeProduct(productsRepo, await productsRepo.create.mock.calls[0].result);

  const patchRes = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(patchRes.status, 200);
  assert.equal((await patchRes.json()).isActive, false);
  assert.deepEqual(productsRepo.update.mock.calls[0].arguments, [id, { isActive: false }]);

  assert.equal(
    (await request(port, 'PATCH', `/products/${id}`, { token: adminToken, body: {} })).status,
    400,
  );

  assert.equal(
    (await request(port, 'GET', `/products/${NON_EXISTENT_ID}`, { token: adminToken })).status,
    404,
  );
});

test('API PATCH /products/:id refuses to deactivate a product with size configurations', async (t) => {
  const { server, port, catId, productsRepo, typesRepo, sizeRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  // A pizza component with a size configuration
  const type = { _id: TYPE_ID, name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1, isActive: true };
  typesRepo.findById.mock.mockImplementation(async (id) => (String(id) === TYPE_ID ? type : null));
  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      name: 'Mozzarella',
      description: 'Cheese',
      sellable: false,
      stockControlled: true,
      categoryId: catId,
      pizzaComponentTypeId: String(type._id),
    },
  });
  assert.equal(createRes.status, 201);
  const id = (await createRes.json()).id;
  const created = await productsRepo.create.mock.calls[0].result;
  storeProduct(productsRepo, created);

  const size = { id: SIZE_ID };
  sizeRepo.findById.mock.mockImplementation(async () => ({ _id: SIZE_ID, name: 'Small', isActive: true }));
  const configuration = { pizzaSizeId: SIZE_ID, price: 1.5, stockUnitsConsumed: 2 };
  productsRepo.addSizeConfiguration.mock.mockImplementation(async () => ({
    ...created,
    sizeConfigurations: [configuration],
  }));
  const configRes = await request(port, 'POST', `/products/${id}/size-configurations`, {
    token: adminToken,
    body: { pizzaSizeId: size.id, price: 1.5, stockUnitsConsumed: 2 },
  });
  assert.equal(configRes.status, 201);
  assert.deepEqual(productsRepo.addSizeConfiguration.mock.calls[0].arguments, [id, configuration]);

  // Step: the product now has the size configuration.
  storeProduct(productsRepo, { ...created, sizeConfigurations: [configuration] });

  // 409 Conflict - the product has size configurations and cannot be removed
  const blocked = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(blocked.status, 409);
  assert.equal(productsRepo.update.mock.callCount(), 0);

  // The product is still active
  const found = await request(port, 'GET', `/products/${id}`, { token: adminToken });
  assert.equal((await found.json()).isActive, true);

  // Other changes are still allowed
  const renamed = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { name: 'Mozzarella Extra' },
  });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).name, 'Mozzarella Extra');

  // 200 OK - once the configuration is removed the product can be deactivated
  productsRepo.removeSizeConfiguration.mock.mockImplementation(async () => ({
    ...created,
    sizeConfigurations: [],
  }));
  const removed = await request(port, 'DELETE', `/products/${id}/size-configurations/${size.id}`, {
    token: adminToken,
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(productsRepo.removeSizeConfiguration.mock.calls[0].arguments, [id, SIZE_ID]);

  // Step: the product no longer has size configurations.
  storeProduct(productsRepo, { ...created, sizeConfigurations: [] });
  const deactivated = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivated.status, 200);
  assert.equal((await deactivated.json()).isActive, false);
  assert.deepEqual(productsRepo.update.mock.calls.at(-1).arguments, [id, { isActive: false }]);
});