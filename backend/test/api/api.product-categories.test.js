import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyProductCategoriesRepository } from '../infrastructure/product-categories.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';
 
process.env.JWT_SECRET = 'test_secret_key';
 
// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';

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
  const categoriesRepo = createDummyProductCategoriesRepository();
 
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    productCategoriesRepository: categoriesRepo,
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
 
  return { server, port, managerToken, employeeToken, categoriesRepo };
}

test('API /product-categories (401 and 403)', async (t) => {
  const { server, port, employeeToken } = await setupTestServer();
 
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
});

test('API POST /product-categories (201, 400, 409)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
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
 
  // 400 Bad Request - missing, blank and non-text name
  for (const invalidBody of [{}, { name: '' }, { name: '   ' }, { name: 123 }, { other: 'x' }]) {
    assert.equal(
      (await request(port, 'POST', '/product-categories', { token: managerToken, body: invalidBody }))
        .status,
      400,
      JSON.stringify(invalidBody),
    );
  }
 
  // 409 Conflict - same name with a different case
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
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
 
  for (const name of ['Café', 'Pizzas']) {
    await request(port, 'POST', '/product-categories', { token: managerToken, body: { name } });
  }
 
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
});

test('API GET /product-categories/:id (400, 404, 200)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
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
});
 
test('API PUT /product-categories/:id (200, 400, 404, 409)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
 
  await request(port, 'POST', '/product-categories', { token: managerToken, body: { name: 'Pizzas' } });
  const drinks = await (
    await request(port, 'POST', '/product-categories', {
      token: managerToken,
      body: { name: 'Bebidas' },
    })
  ).json();
 
  // 200 OK
  const ok = await request(port, 'PUT', `/product-categories/${drinks.id}`, {
    token: managerToken,
    body: { name: 'Soft Drinks' },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { id: drinks.id, name: 'Soft Drinks', isActive: true });
 
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

test('API DELETE /product-categories/:id (400, 404, 204)', async (t) => {
  const {
    server,
    port,
    managerToken,
    categoriesRepo,
  } = await setupTestServer();

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const createRes = await request(port, 'POST', '/product-categories', {
    token: managerToken,
    body: { name: 'Pizzas' },
  });

  assert.equal(createRes.status, 201);

  const created = await createRes.json();

  const invalidIdRes = await request(
    port,
    'DELETE',
    '/product-categories/id_invalido',
    { token: managerToken },
  );

  assert.equal(invalidIdRes.status, 400);

  const notFoundRes = await request(
    port,
    'DELETE',
    `/product-categories/${NON_EXISTENT_ID}`,
    { token: managerToken },
  );

  assert.equal(notFoundRes.status, 404);

  const deleteRes = await request(
    port,
    'DELETE',
    `/product-categories/${created.id}`,
    { token: managerToken },
  );

  assert.equal(deleteRes.status, 204);

  const categories = categoriesRepo._getCategories();
  assert.equal(categories.length, 1);
  assert.equal(categories[0].name, 'Pizzas');
  assert.equal(categories[0].isActive, false);
});