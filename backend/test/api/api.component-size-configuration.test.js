import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyPizzaSizeRepository } from '../infrastructure/pizza-size.dummy.repository.js';
import { createSize } from '../../src/application/pizza-size.service.js';
import { registerUser } from '../../src/application/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

// Valid identifier format (24 hex characters) that does not belong to any product or pizza size
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const PIZZA_COMPONENT_TYPE_ID = 'abcdef000000000000000001';

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
const COLA = { name: 'Cola', description: 'Drink', stockControlled: false };

const configurationsPath = (productId, sizeId) =>
  `/products/${productId}/size-configurations${sizeId === undefined ? '' : `/${sizeId}`}`;

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
    body: { identifier, password: 'StrongPassword123!' },
  });
  return (await res.json()).token;
}

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const productsRepo = createDummyProductsRepository();
  const sizeRepo = createDummyPizzaSizeRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    productsRepository: productsRepo,
    sizeRepository: sizeRepo,
  }).listen(0);

  await once(server, 'listening');

  const port = server.address().port;

  await registerUser(
    { email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    usersRepo,
  );
  await registerUser(
    { email: 'emp@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    usersRepo,
  );

  const managerToken = await login(port, 'admin@laprizza.pt');
  const employeeToken = await login(port, 'emp@laprizza.pt');

  // Data the configurations refer to: three products and two pizza sizes
  const mozzarella = await productsRepo.create(MOZZARELLA);
  const oregano = await productsRepo.create(OREGANO);
  const cola = await productsRepo.create(COLA);
  const small = await createSize({ name: 'Small' }, sizeRepo);
  const large = await createSize({ name: 'Large' }, sizeRepo);

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
    small,
    large,
  };
}

function closeServer(server) {
  server.close();
  server.closeAllConnections();
}

async function createConfiguration(port, token, productId, body) {
  return request(port, 'POST', configurationsPath(productId), { token, body });
}

test('API /products/:productId/size-configurations (401 and 403)', async (t) => {
  const { server, port, employeeToken, mozzarella, small } = await setupTestServer();

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
});

test('API /products/:productId/size-configurations (400 for invalid identifiers)', async (t) => {
  const { server, port, managerToken, mozzarella, small } = await setupTestServer();

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
});

test('API POST /products/:productId/size-configurations (201)', async (t) => {
  const { server, port, managerToken, mozzarella, oregano, small, large } =
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
  const { server, port, managerToken, mozzarella, small } = await setupTestServer();

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
});

test('API POST /products/:productId/size-configurations (400 for an invalid body)', async (t) => {
  const { server, port, managerToken, mozzarella, small } = await setupTestServer();

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
  const list = await request(port, 'GET', configurationsPath(mozzarella._id), {
    token: managerToken,
  });
  assert.deepEqual(await list.json(), []);
});

test('API POST /products/:productId/size-configurations (400 for the business rules)', async (t) => {
  const { server, port, managerToken, mozzarella, oregano, cola, small } =
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
  for (const product of [mozzarella, oregano, cola]) {
    const list = await request(port, 'GET', configurationsPath(product._id), {
      token: managerToken,
    });
    assert.deepEqual(await list.json(), [], product.name);
  }
});

test('API POST /products/:productId/size-configurations (404)', async (t) => {
  const { server, port, managerToken, productsRepo, sizeRepo, mozzarella, small } =
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
  await sizeRepo.update(small.id, { isActive: false });
  assert.equal((await createConfiguration(port, managerToken, mozzarella._id, body)).status, 404);

  // 404 Not Found - inactive product
  const inactive = await productsRepo.create({ ...MOZZARELLA, name: 'Old', isActive: false });
  const other = await createSize({ name: 'Family' }, sizeRepo);
  assert.equal(
    (
      await createConfiguration(port, managerToken, inactive._id, {
        ...body,
        pizzaSizeId: other.id,
      })
    ).status,
    404,
  );
});

test('API POST /products/:productId/size-configurations (409)', async (t) => {
  const { server, port, managerToken, mozzarella, oregano, small } = await setupTestServer();

  t.after(() => closeServer(server));

  const body = { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 };
  assert.equal((await createConfiguration(port, managerToken, mozzarella._id, body)).status, 201);

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

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: large.id,
    price: 2,
    stockUnitsConsumed: 2,
  });
  await createConfiguration(port, managerToken, oregano._id, {
    pizzaSizeId: small.id,
    price: 0.5,
  });

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
  await productsRepo.update(mozzarella._id, { isActive: false });
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
  const { server, port, managerToken, employeeToken, mozzarella, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1.5,
    stockUnitsConsumed: 2,
  });

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
  const { server, port, managerToken, mozzarella, oregano, small, large } =
    await setupTestServer();

  t.after(() => closeServer(server));

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: large.id,
    price: 2,
    stockUnitsConsumed: 2,
  });
  await createConfiguration(port, managerToken, oregano._id, { pizzaSizeId: small.id, price: 0.5 });

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

  // The change is persisted and the other configurations are untouched
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
  const { server, port, managerToken, mozzarella, oregano, small } = await setupTestServer();

  t.after(() => closeServer(server));

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await createConfiguration(port, managerToken, oregano._id, { pizzaSizeId: small.id, price: 0.5 });

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
  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });

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
  await productsRepo.update(mozzarella._id, { isActive: false });
  assert.equal(
    (
      await request(port, 'PUT', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
        body,
      })
    ).status,
    404,
  );
});

test('API DELETE /products/:productId/size-configurations/:sizeId (200)', async (t) => {
  const { server, port, managerToken, mozzarella, small, large } = await setupTestServer();

  t.after(() => closeServer(server));

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: large.id,
    price: 2,
    stockUnitsConsumed: 2,
  });

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

  // It is gone, and the other configuration is untouched
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

  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await productsRepo.update(mozzarella._id, { isActive: false });

  const removed = await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal(removed.status, 200);
});

test('API DELETE /products/:productId/size-configurations/:sizeId (404)', async (t) => {
  const { server, port, managerToken, mozzarella, small } = await setupTestServer();

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

  // 404 Not Found - already removed
  await createConfiguration(port, managerToken, mozzarella._id, {
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
    token: managerToken,
  });
  assert.equal(
    (
      await request(port, 'DELETE', configurationsPath(mozzarella._id, small.id), {
        token: managerToken,
      })
    ).status,
    404,
  );
});