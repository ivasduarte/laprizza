import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

// Valid identifier format (24 hex characters) that does not belong to any product or pizza size
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const PIZZA_COMPONENT_TYPE_ID = 'abcdef000000000000000001';
const MOZZARELLA_ID = 'e0e0e0000000000000000001';
const OREGANO_ID = 'e0e0e0000000000000000002';
const COLA_ID = 'e0e0e0000000000000000003';
const INACTIVE_ID = 'e0e0e0000000000000000004';
const SMALL_ID = 'd0d0d0000000000000000001';
const LARGE_ID = 'd0d0d0000000000000000002';
const FAMILY_ID = 'd0d0d0000000000000000003';

// Pizza components: a stock controlled one (Mozzarella) and one without stock control (Oregano)
const MOZZARELLA = {
  name: 'Mozzarella',
  description: 'Cheese',
  stockControlled: true,
  pizzaComponentTypeId: PIZZA_COMPONENT_TYPE_ID,
};
const OREGANO = {
  name: 'Oregano',
  description: 'Herb',
  stockControlled: false,
  pizzaComponentTypeId: PIZZA_COMPONENT_TYPE_ID,
};
// A product that is not a pizza component
const COLA = { name: 'Cola', description: 'Drink', stockControlled: false, pizzaComponentTypeId: null };

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

const configurationsPath = (productId, sizeId) =>
  `/products/${productId}/size-configurations${sizeId === undefined ? '' : `/${sizeId}`}`;

/** Stored product document. */
const storedProduct = (_id, data, sizeConfigurations = [], extra = {}) => ({
  _id,
  isActive: true,
  ...data,
  sizeConfigurations,
  ...extra,
});

const isForSize = (pizzaSizeId) => (c) => String(c.pizzaSizeId) === String(pizzaSizeId);

/**
 * Programs the products repository with the stored products: findById returns them and the
 * atomic write operations return the product with the change applied (as the real ones do).
 */
function storeProducts(productsRepo, products) {
  const byId = (id) => products.find((p) => p._id === String(id)) ?? null;
  productsRepo.findById.mock.mockImplementation(async (id) => byId(id));
  productsRepo.addSizeConfiguration.mock.mockImplementation(async (id, configuration) => {
    const product = byId(id);
    if (!product || product.sizeConfigurations.some(isForSize(configuration.pizzaSizeId))) return null;
    return { ...product, sizeConfigurations: [...product.sizeConfigurations, { ...configuration }] };
  });
  productsRepo.updateSizeConfiguration.mock.mockImplementation(
    async (id, pizzaSizeId, { price, stockUnitsConsumed }) => {
      const product = byId(id);
      if (!product?.sizeConfigurations.some(isForSize(pizzaSizeId))) return null;
      return {
        ...product,
        sizeConfigurations: product.sizeConfigurations.map((c) =>
          isForSize(pizzaSizeId)(c) ? { ...c, price, stockUnitsConsumed } : c,
        ),
      };
    },
  );
  productsRepo.removeSizeConfiguration.mock.mockImplementation(async (id, pizzaSizeId) => {
    const product = byId(id);
    if (!product?.sizeConfigurations.some(isForSize(pizzaSizeId))) return null;
    return {
      ...product,
      sizeConfigurations: product.sizeConfigurations.filter((c) => !isForSize(pizzaSizeId)(c)),
    };
  });
}

/** Programs the size repository with the stored pizza sizes. */
function storeSizes(sizeRepo, sizes) {
  sizeRepo.findById.mock.mockImplementation(
    async (id) => sizes.find((s) => s._id === String(id)) ?? null,
  );
}

const SMALL = { _id: SMALL_ID, name: 'Small', isActive: true };
const LARGE = { _id: LARGE_ID, name: 'Large', isActive: true };

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
  const productsRepo = {
    findById: mock.fn(),
    addSizeConfiguration: mock.fn(),
    updateSizeConfiguration: mock.fn(),
    removeSizeConfiguration: mock.fn(),
  };
  const sizeRepo = { findById: mock.fn() };

  // Data the configurations refer to: three products (without configurations) and two pizza sizes
  const mozzarella = storedProduct(MOZZARELLA_ID, MOZZARELLA);
  const oregano = storedProduct(OREGANO_ID, OREGANO);
  const cola = storedProduct(COLA_ID, COLA);
  storeProducts(productsRepo, [mozzarella, oregano, cola]);
  storeSizes(sizeRepo, [SMALL, LARGE]);

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    productsRepository: productsRepo,
    sizeRepository: sizeRepo,
  }).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  const managerToken = await login(port, 'admin@laprizza.pt');
  const employeeToken = await login(port, 'emp@laprizza.pt');

  return {
    server,
    port,
    managerToken,
    employeeToken,
    productsRepo,
    sizeRepo,
    mozzarella,
    oregano,
    cola,
    small: { id: SMALL_ID },
    large: { id: LARGE_ID },
  };
}

function closeServer(server) {
  server.close();
  server.closeAllConnections();
}

/** Asserts that no write operation reached the products repository. */
function assertNothingWritten(productsRepo) {
  assert.equal(productsRepo.addSizeConfiguration.mock.callCount(), 0);
  assert.equal(productsRepo.updateSizeConfiguration.mock.callCount(), 0);
  assert.equal(productsRepo.removeSizeConfiguration.mock.callCount(), 0);
}

async function createConfiguration(port, token, productId, body) {
  return request(port, 'POST', configurationsPath(productId), { token, body });
}

test('API /products/:productId/size-configurations (401 and 403)', async (t) => {
  const { server, port, employeeToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  const endpoints = [
    ['GET', configurationsPath(mozzarella._id), undefined, false],
    ['POST', configurationsPath(mozzarella._id), { pizzaSizeId: small.id, price: 1 }, true],
    ['GET', configurationsPath(mozzarella._id, small.id), undefined, false],
    ['PUT', configurationsPath(mozzarella._id, small.id), { price: 1 }, true],
    ['DELETE', configurationsPath(mozzarella._id, small.id), undefined, true],
  ];

  for (const [method, path, body, managerOnly] of endpoints) {
    // 401 Unauthorized - no token
    assert.equal((await request(port, method, path, { body })).status, 401, `${method} ${path}`);

    // 403 Forbidden - employees can only read
    if (managerOnly) {
      assert.equal(
        (await request(port, method, path, { token: employeeToken, body })).status,
        403,
        `${method} ${path}`,
      );
    }
  }
  assert.equal(productsRepo.findById.mock.callCount(), 0);
});

test('API /products/:productId/size-configurations (400 for invalid identifiers)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  const body = { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 };
  const endpoints = [
    ['GET', configurationsPath('abc'), undefined],
    ['POST', configurationsPath('abc'), body],
    ['GET', configurationsPath('abc', small.id), undefined],
    ['GET', configurationsPath(mozzarella._id, 'abc'), undefined],
    ['PUT', configurationsPath(mozzarella._id, 'abc'), { price: 1, stockUnitsConsumed: 1 }],
    ['DELETE', configurationsPath(mozzarella._id, 'abc'), undefined],
  ];

  for (const [method, path, requestBody] of endpoints) {
    assert.equal(
      (await request(port, method, path, { token: managerToken, body: requestBody })).status,
      400,
      `${method} ${path}`,
    );
  }
  assert.equal(productsRepo.findById.mock.callCount(), 0);
});

test('API POST /products/:productId/size-configurations (201)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, oregano, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  // 201 Created - stock controlled component, the product comes from the path
  const created = await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 2.5,
    stockUnitsConsumed: 3,
  });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    productId: mozzarella._id,
    pizzaSizeId: small.id,
    price: 2.5,
    stockUnitsConsumed: 3,
  });
  assert.deepEqual(productsRepo.addSizeConfiguration.mock.calls[0].arguments, [
    mozzarella._id,
    { pizzaSizeId: small.id, price: 2.5, stockUnitsConsumed: 3 },
  ]);

  // 201 Created - component without stock control, stock units omitted or null
  const omitted = await createConfiguration(port, managerToken, oregano._id, {
    pizzaSizeId: small.id,
    price: 0.5,
  });
  assert.equal(omitted.status, 201);
  assert.equal((await omitted.json()).stockUnitsConsumed, null);

  const explicitNull = await createConfiguration(port, managerToken, oregano._id, {
    pizzaSizeId: large.id,
    price: 0,
    stockUnitsConsumed: null,
  });
  assert.equal(explicitNull.status, 201);
  const explicitNullBody = await explicitNull.json();
  assert.equal(explicitNullBody.price, 0);
  assert.equal(explicitNullBody.stockUnitsConsumed, null);
});

test('API POST /products/:productId/size-configurations ignores unknown fields', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  const created = await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 2,
    stockUnitsConsumed: 1,
    productId: NON_EXISTENT_ID,
    isActive: false,
    other: 'x',
  });

  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    productId: mozzarella._id,
    pizzaSizeId: small.id,
    price: 2,
    stockUnitsConsumed: 1,
  });
  assert.deepEqual(productsRepo.addSizeConfiguration.mock.calls[0].arguments, [
    mozzarella._id,
    { pizzaSizeId: small.id, price: 2, stockUnitsConsumed: 1 },
  ]);
});

test('API POST /products/:productId/size-configurations (400 for an invalid body)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  const valid = { pizzaSizeId: small.id, price: 2, stockUnitsConsumed: 1 };
  const invalidBodies = [
    {},
    { other: 'x' },
    { ...valid, pizzaSizeId: undefined },
    { ...valid, pizzaSizeId: '' },
    { ...valid, pizzaSizeId: 'abc' },
    { ...valid, pizzaSizeId: 123 },
    { ...valid, price: undefined },
    { ...valid, price: null },
    { ...valid, price: -1 },
    { ...valid, price: '2' },
    { ...valid, stockUnitsConsumed: 0 },
    { ...valid, stockUnitsConsumed: -1 },
    { ...valid, stockUnitsConsumed: 1.5 },
    { ...valid, stockUnitsConsumed: '1' },
  ];

  for (const invalidBody of invalidBodies) {
    assert.equal(
      (await createConfiguration(port, managerToken, mozzarella._id, invalidBody)).status,
      400,
      JSON.stringify(invalidBody),
    );
  }

  // Nothing was saved
  assertNothingWritten(productsRepo);
});

test('API POST /products/:productId/size-configurations (400 for the business rules)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, oregano, cola, small } =
    await setupTestServer();

  t.after(() => closeServer(server));

  // A product that is not a pizza component cannot have configurations
  assert.equal(
    (await createConfiguration(port, managerToken, cola._id, { pizzaSizeId: small.id, price: 1 }))
      .status,
    400,
  );

  // Stock controlled components must define the stock units consumed
  assert.equal(
    (
      await createConfiguration(port, managerToken, mozzarella._id, {
        pizzaSizeId: small.id,
        price: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await createConfiguration(port, managerToken, mozzarella._id, {
        pizzaSizeId: small.id,
        price: 1,
        stockUnitsConsumed: null,
      })
    ).status,
    400,
  );

  // Components without stock control cannot define them
  assert.equal(
    (
      await createConfiguration(port, managerToken, oregano._id, {
        pizzaSizeId: small.id,
        price: 1,
        stockUnitsConsumed: 2,
      })
    ).status,
    400,
  );

  // Nothing was saved
  assertNothingWritten(productsRepo);
});

test('API POST /products/:productId/size-configurations (404)', async (t) => {
  const { server, port, managerToken, productsRepo, sizeRepo, mozzarella, oregano, cola, small } =
    await setupTestServer();

  t.after(() => closeServer(server));

  const body = { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 };

  // 404 Not Found - unknown product
  assert.equal((await createConfiguration(port, managerToken, NON_EXISTENT_ID, body)).status, 404);

  // 404 Not Found - unknown pizza size
  assert.equal(
    (
      await createConfiguration(port, managerToken, mozzarella._id, {
        ...body,
        pizzaSizeId: NON_EXISTENT_ID,
      })
    ).status,
    404,
  );

  // 404 Not Found - inactive pizza size
  storeSizes(sizeRepo, [{ ...SMALL, isActive: false }, LARGE, { _id: FAMILY_ID, name: 'Family', isActive: true }]);
  assert.equal((await createConfiguration(port, managerToken, mozzarella._id, body)).status, 404);

  // 404 Not Found - inactive product
  const inactive = storedProduct(INACTIVE_ID, { ...MOZZARELLA, name: 'Old' }, [], { isActive: false });
  storeProducts(productsRepo, [mozzarella, oregano, cola, inactive]);
  assert.equal(
    (
      await createConfiguration(port, managerToken, inactive._id, {
        ...body,
        pizzaSizeId: FAMILY_ID,
      })
    ).status,
    404,
  );

  assertNothingWritten(productsRepo);
});

test('API POST /products/:productId/size-configurations (409)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, oregano, cola, small } =
    await setupTestServer();

  t.after(() => closeServer(server));

  const body = { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 };
  assert.equal((await createConfiguration(port, managerToken, mozzarella._id, body)).status, 201);

  // Step: mozzarella is now configured for the small size.
  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: [body] },
    oregano,
    cola,
  ]);

  // 409 Conflict - the component is already configured for that pizza size
  assert.equal(
    (
      await createConfiguration(port, managerToken, mozzarella._id, {
        ...body,
        price: 9,
        stockUnitsConsumed: 9,
      })
    ).status,
    409,
  );
  assert.equal(productsRepo.addSizeConfiguration.mock.callCount(), 1);

  // The existing configuration was kept
  const found = await request(port, 'GET', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal((await found.json()).price, 1);

  // Another component can be configured for the same pizza size
  assert.equal(
    (await createConfiguration(port, managerToken, oregano._id, { pizzaSizeId: small.id, price: 1 }))
      .status,
    201,
  );
});

test('API GET /products/:productId/size-configurations (200 and 404)', async (t) => {
  const {
    server,
    port,
    managerToken,
    employeeToken,
    productsRepo,
    mozzarella,
    oregano,
    cola,
    small,
    large,
  } = await setupTestServer();

  t.after(() => closeServer(server));

  // 200 OK - no configurations yet
  const empty = await request(port, 'GET', configurationsPath(mozzarella._id), {
    token: managerToken,
  });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);

  // Step: mozzarella has two configurations and oregano has one.
  const mozzarellaConfigurations = [
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ];
  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: mozzarellaConfigurations },
    { ...oregano, sizeConfigurations: [{ pizzaSizeId: small.id, price: 0.5, stockUnitsConsumed: null }] },
    cola,
  ]);

  // 200 OK - only the configurations of the product, also for employees
  for (const token of [managerToken, employeeToken]) {
    const list = await request(port, 'GET', configurationsPath(mozzarella._id), { token });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), [
      { productId: mozzarella._id, pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
      { productId: mozzarella._id, pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    ]);
  }

  // 200 OK - an inactive product can still be consulted
  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: mozzarellaConfigurations, isActive: false },
  ]);
  const inactive = await request(port, 'GET', configurationsPath(mozzarella._id), {
    token: managerToken,
  });
  assert.equal(inactive.status, 200);
  assert.equal((await inactive.json()).length, 2);

  // 404 Not Found - unknown product
  assert.equal(
    (await request(port, 'GET', configurationsPath(NON_EXISTENT_ID), { token: managerToken }))
      .status,
    404,
  );
});

test('API GET /products/:productId/size-configurations/:sizeId (200 and 404)', async (t) => {
  const { server, port, managerToken, employeeToken, productsRepo, mozzarella, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: [{ pizzaSizeId: small.id, price: 1.5, stockUnitsConsumed: 2 }] },
  ]);

  // 200 OK - also for employees
  for (const token of [managerToken, employeeToken]) {
    const found = await request(port, 'GET', configurationsPath(mozzarella._id, small.id), {
      token,
    });
    assert.equal(found.status, 200);
    assert.deepEqual(await found.json(), {
      productId: mozzarella._id,
      pizzaSizeId: small.id,
      price: 1.5,
      stockUnitsConsumed: 2,
    });
  }

  // 404 Not Found - the component is not configured for that pizza size
  assert.equal(
    (
      await request(port, 'GET', configurationsPath(mozzarella._id, large.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(port, 'GET', configurationsPath(mozzarella._id, NON_EXISTENT_ID), {
        token: managerToken,
      })
    ).status,
    404,
  );

  // 404 Not Found - unknown product
  assert.equal(
    (
      await request(port, 'GET', configurationsPath(NON_EXISTENT_ID, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
});

test('API PUT /products/:productId/size-configurations/:sizeId (200)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, oregano, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  const largeConfiguration = { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 };
  const oreganoConfigured = {
    ...oregano,
    sizeConfigurations: [{ pizzaSizeId: small.id, price: 0.5, stockUnitsConsumed: null }],
  };
  storeProducts(productsRepo, [
    {
      ...mozzarella,
      sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }, largeConfiguration],
    },
    oreganoConfigured,
  ]);

  // 200 OK - price and stock units are replaced
  const updated = await request(port, 'PUT', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
    body: { price: 1.75, stockUnitsConsumed: 4, pizzaSizeId: NON_EXISTENT_ID, other: 'x' },
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), {
    productId: mozzarella._id,
    pizzaSizeId: small.id,
    price: 1.75,
    stockUnitsConsumed: 4,
  });

  // Only the configuration of the path is changed, with the new price and stock units
  assert.deepEqual(productsRepo.updateSizeConfiguration.mock.calls[0].arguments, [
    mozzarella._id,
    small.id,
    { price: 1.75, stockUnitsConsumed: 4 },
  ]);

  // Step: the change is persisted and the other configurations are untouched
  storeProducts(productsRepo, [
    {
      ...mozzarella,
      sizeConfigurations: [{ pizzaSizeId: small.id, price: 1.75, stockUnitsConsumed: 4 }, largeConfiguration],
    },
    oreganoConfigured,
  ]);
  const list = await request(port, 'GET', configurationsPath(mozzarella._id), {
    token: managerToken,
  });
  assert.deepEqual(await list.json(), [
    { productId: mozzarella._id, pizzaSizeId: small.id, price: 1.75, stockUnitsConsumed: 4 },
    { productId: mozzarella._id, pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ]);

  // 200 OK - component without stock control, zero price
  const free = await request(port, 'PUT', configurationsPath(oregano._id, small.id), {
    token: managerToken,
    body: { price: 0 },
  });
  assert.equal(free.status, 200);
  assert.equal((await free.json()).price, 0);
});

test('API PUT /products/:productId/size-configurations/:sizeId (400)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, oregano, small } =
    await setupTestServer();

  t.after(() => closeServer(server));

  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }] },
    { ...oregano, sizeConfigurations: [{ pizzaSizeId: small.id, price: 0.5, stockUnitsConsumed: null }] },
  ]);

  const invalidBodies = [
    {},
    { other: 'x' },
    { stockUnitsConsumed: 2 },
    { price: null, stockUnitsConsumed: 2 },
    { price: -1, stockUnitsConsumed: 2 },
    { price: '2', stockUnitsConsumed: 2 },
    { price: 2, stockUnitsConsumed: 0 },
    { price: 2, stockUnitsConsumed: 1.5 },
    { price: 2, stockUnitsConsumed: '2' },
    // Business rule: stock controlled components must define the stock units
    { price: 2 },
    { price: 2, stockUnitsConsumed: null },
  ];

  for (const invalidBody of invalidBodies) {
    assert.equal(
      (
        await request(port, 'PUT', configurationsPath(mozzarella._id, small.id), {
          token: managerToken,
          body: invalidBody,
        })
      ).status,
      400,
      JSON.stringify(invalidBody),
    );
  }

  // Business rule: components without stock control cannot define the stock units
  assert.equal(
    (
      await request(port, 'PUT', configurationsPath(oregano._id, small.id), {
        token: managerToken,
        body: { price: 1, stockUnitsConsumed: 2 },
      })
    ).status,
    400,
  );

  // Nothing was changed
  assertNothingWritten(productsRepo);
  const found = await request(port, 'GET', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.deepEqual(await found.json(), {
    productId: mozzarella._id,
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
});

test('API PUT /products/:productId/size-configurations/:sizeId (404)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  const body = { price: 2, stockUnitsConsumed: 2 };
  const configured = {
    ...mozzarella,
    sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }],
  };
  storeProducts(productsRepo, [configured]);

  // 404 Not Found - unknown product
  assert.equal(
    (
      await request(port, 'PUT', configurationsPath(NON_EXISTENT_ID, small.id), {
        token: managerToken,
        body,
      })
    ).status,
    404,
  );

  // 404 Not Found - the component is not configured for that pizza size
  assert.equal(
    (
      await request(port, 'PUT', configurationsPath(mozzarella._id, large.id), {
        token: managerToken,
        body,
      })
    ).status,
    404,
  );

  // 404 Not Found - inactive product
  storeProducts(productsRepo, [{ ...configured, isActive: false }]);
  assert.equal(
    (
      await request(port, 'PUT', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
        body,
      })
    ).status,
    404,
  );
  assertNothingWritten(productsRepo);
});

test('API DELETE /products/:productId/size-configurations/:sizeId (200)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  const largeConfiguration = { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 };
  storeProducts(productsRepo, [
    {
      ...mozzarella,
      sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }, largeConfiguration],
    },
  ]);

  // 200 OK - the removed configuration is returned
  const removed = await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    productId: mozzarella._id,
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  assert.deepEqual(productsRepo.removeSizeConfiguration.mock.calls[0].arguments, [
    mozzarella._id,
    small.id,
  ]);

  // Step: it is gone, and the other configuration is untouched
  storeProducts(productsRepo, [{ ...mozzarella, sizeConfigurations: [largeConfiguration] }]);
  assert.equal(
    (
      await request(port, 'GET', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
  const list = await request(port, 'GET', configurationsPath(mozzarella._id), {
    token: managerToken,
  });
  assert.deepEqual(await list.json(), [
    { productId: mozzarella._id, pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ]);

  // The pizza size is free to be configured again
  const again = await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 3,
    stockUnitsConsumed: 5,
  });
  assert.equal(again.status, 201);
});

test('API DELETE /products/:productId/size-configurations/:sizeId (200 for an inactive product)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  storeProducts(productsRepo, [
    {
      ...mozzarella,
      isActive: false,
      sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }],
    },
  ]);

  const removed = await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal(removed.status, 200);
  assert.equal(productsRepo.removeSizeConfiguration.mock.callCount(), 1);
});

test('API DELETE /products/:productId/size-configurations/:sizeId (404)', async (t) => {
  const { server, port, managerToken, productsRepo, mozzarella, small } = await setupTestServer();

  t.after(() => closeServer(server));

  // 404 Not Found - unknown product
  assert.equal(
    (
      await request(port, 'DELETE', configurationsPath(NON_EXISTENT_ID, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );

  // 404 Not Found - the component is not configured for that pizza size
  assert.equal(
    (
      await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
  assertNothingWritten(productsRepo);

  // 404 Not Found - already removed
  storeProducts(productsRepo, [
    { ...mozzarella, sizeConfigurations: [{ pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 }] },
  ]);
  await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal(productsRepo.removeSizeConfiguration.mock.callCount(), 1);

  // Step: the configuration no longer exists.
  storeProducts(productsRepo, [{ ...mozzarella, sizeConfigurations: [] }]);
  assert.equal(
    (
      await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
  assert.equal(productsRepo.removeSizeConfiguration.mock.callCount(), 1);
});
