import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyPizzaComponentTypesRepository } from '../infrastructure/pizza-component-type.dummy.repository.js';
import { registerUser } from '../../src/application/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

const BASE_PATH = '/pizza-component-type';
 
// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const CHEESE = { name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 };
const TOPPING = { name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null };
 
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
 
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    pizzaComponentTypesRepository: createDummyPizzaComponentTypesRepository(),
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
 
  return { server, port, managerToken, employeeToken };
}
 
function closeServer(server) {
  server.close();
  server.closeAllConnections();
}
 
async function createType(port, token, body) {
  const res = await request(port, 'POST', BASE_PATH, { token, body });
  return res.json();
}

test('API /pizza-component-type (401 and 403)', async (t) => {
  const { server, port, employeeToken } = await setupTestServer();
 
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
});

test('API POST /pizza-component-type (201)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
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
});
 
test('API POST /pizza-component-type ignores isActive sent by the client', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const created = await request(port, 'POST', BASE_PATH, {
    token: managerToken,
    body: { ...CHEESE, isActive: false, other: 'x' },
  });
 
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.isActive, true);
  assert.equal(body.other, undefined);
});
 
test('API POST /pizza-component-type (400)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
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
  const list = await request(port, 'GET', BASE_PATH, { token: managerToken });
  assert.deepEqual(await list.json(), []);
});
 
test('API POST /pizza-component-type (409)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  await createType(port, managerToken, { ...CHEESE, name: 'Café' });
 
  // 409 Conflict - same name with a different case and without accents
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
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  // Created out of order, to check the sorting by assembly order
  await createType(port, managerToken, TOPPING);
  await createType(port, managerToken, { ...CHEESE, name: 'Café' });
 
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
});
 
test('API GET /pizza-component-type/:id (400, 404, 200)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const created = await createType(port, managerToken, CHEESE);
 
  assert.equal(
    (await request(port, 'GET', `${BASE_PATH}/id_invalido`, { token: managerToken })).status,
    400,
  );
  assert.equal(
    (await request(port, 'GET', `${BASE_PATH}/${NON_EXISTENT_ID}`, { token: managerToken })).status,
    404,
  );
 
  const res = await request(port, 'GET', `${BASE_PATH}/${created.id}`, { token: managerToken });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: created.id, ...CHEESE, isActive: true });
});
 
test('API PUT /pizza-component-type/:id (200)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const created = await createType(port, managerToken, CHEESE);
 
  const ok = await request(port, 'PUT', `${BASE_PATH}/${created.id}`, {
    token: managerToken,
    body: { name: '  Extra   Cheese ', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), {
    id: created.id,
    name: 'Extra Cheese',
    assemblyOrder: 7,
    minQuantity: 1,
    maxQuantity: null,
    isActive: true,
  });
 
  // The type keeps its own values and name, only the case changes
  const sameValues = await request(port, 'PUT', `${BASE_PATH}/${created.id}`, {
    token: managerToken,
    body: { name: 'extra cheese', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  });
  assert.equal(sameValues.status, 200);
});
 
test('API PUT /pizza-component-type/:id cannot deactivate the type', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const created = await createType(port, managerToken, CHEESE);
 
  const res = await request(port, 'PUT', `${BASE_PATH}/${created.id}`, {
    token: managerToken,
    body: { ...CHEESE, isActive: false },
  });
 
  assert.equal(res.status, 200);
  assert.equal((await res.json()).isActive, true);
});
 
test('API PUT /pizza-component-type/:id (400, 404, 409)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  await createType(port, managerToken, CHEESE);
  const topping = await createType(port, managerToken, TOPPING);
 
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
        await request(port, 'PUT', `${BASE_PATH}/${topping.id}`, {
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
      await request(port, 'PUT', `${BASE_PATH}/${NON_EXISTENT_ID}`, {
        token: managerToken,
        body: TOPPING,
      })
    ).status,
    404,
  );
 
  // 409 Conflict - name of another type, with a different case
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${topping.id}`, {
        token: managerToken,
        body: { ...TOPPING, name: 'CHEESE' },
      })
    ).status,
    409,
  );
 
  // 409 Conflict - assembly order of another type
  assert.equal(
    (
      await request(port, 'PUT', `${BASE_PATH}/${topping.id}`, {
        token: managerToken,
        body: { ...TOPPING, assemblyOrder: 3 },
      })
    ).status,
    409,
  );
});
 
test('API DELETE /pizza-component-type/:id (400, 404, 204)', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const created = await createType(port, managerToken, CHEESE);
 
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/id_invalido`, { token: managerToken })).status,
    400,
  );
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${NON_EXISTENT_ID}`, { token: managerToken }))
      .status,
    404,
  );
 
  const removed = await request(port, 'DELETE', `${BASE_PATH}/${created.id}`, {
    token: managerToken,
  });
  assert.equal(removed.status, 204);
 
  // 404 Not Found - the type was already removed
  assert.equal(
    (await request(port, 'DELETE', `${BASE_PATH}/${created.id}`, { token: managerToken })).status,
    404,
  );
});
 
test('API DELETE /pizza-component-type/:id is a soft delete', async (t) => {
  const { server, port, managerToken } = await setupTestServer();
 
  t.after(() => closeServer(server));
 
  const cheese = await createType(port, managerToken, CHEESE);
  await createType(port, managerToken, TOPPING);
 
  await request(port, 'DELETE', `${BASE_PATH}/${cheese.id}`, { token: managerToken });
 
  // It disappears from the list...
  const list = await request(port, 'GET', BASE_PATH, { token: managerToken });
  assert.deepEqual(
    (await list.json()).map((type) => type.name),
    ['Topping'],
  );
 
  // ...but can still be found by ID and by name, flagged as inactive
  const byId = await request(port, 'GET', `${BASE_PATH}/${cheese.id}`, { token: managerToken });
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
      await request(port, 'PUT', `${BASE_PATH}/${cheese.id}`, {
        token: managerToken,
        body: { ...CHEESE, name: 'Other' },
      })
    ).status,
    404,
  );
 
  // Its name and assembly order can be used again
  const recreated = await request(port, 'POST', BASE_PATH, { token: managerToken, body: CHEESE });
  assert.equal(recreated.status, 201);
  assert.notEqual((await recreated.json()).id, cheese.id);
});