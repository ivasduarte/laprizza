import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyAuthInfrastructure } from '../infrastructure/auth.dummy.dependencies.js';
import {
  createDummyPredefinedPizzaRepository,
  SEED_IDS as I,
} from '../infrastructure/predefined-pizzas.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const pizzaRepo = createDummyPredefinedPizzaRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createDummyAuthInfrastructure(),
    usersRepository: usersRepo,
    predefinedPizzaRepository: pizzaRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  await registerUser({ email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' }, usersRepo);
  await registerUser({ email: 'emp@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' }, usersRepo);

  return { server, port, pizzaRepo };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  const { accessToken: token } = await res.json();

  return async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status >= 500) console.error(`[HTTP ${res.status}] ${method} ${path}:`, await res.clone().text());
    return res;
  };
}

const validBody = (overrides = {}) => ({
  productId: I.pizzaProduct,
  sizeIds: [I.sizeSmall, I.sizeLarge],
  componentIds: [I.dough, I.sauce, I.cheese],
  ...overrides,
});

test('API /predefined-pizzas RBAC: Only MANAGER can create and update, EMPLOYEE can read', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/predefined-pizzas', validBody());
  assert.equal(postEmp.status, 403);

  const postMgr = await managerRequest('POST', '/predefined-pizzas', validBody());
  assert.equal(postMgr.status, 201);
  const { id } = await postMgr.json();

  const putEmp = await empRequest('PUT', `/predefined-pizzas/${id}`, { isActive: false });
  assert.equal(putEmp.status, 403);

  assert.equal((await empRequest('GET', '/predefined-pizzas')).status, 200);
  assert.equal((await empRequest('GET', `/predefined-pizzas/${id}`)).status, 200);
  assert.equal((await empRequest('GET', '/predefined-pizzas/name/Margherita')).status, 200);
});

test('API /predefined-pizzas lifecycle and validations', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  assert.equal((await request('POST', '/predefined-pizzas', {})).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ productId: 'abc' }))).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ sizeIds: [] }))).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ componentIds: undefined }))).status, 400);

  const postRes = await request('POST', '/predefined-pizzas', validBody());
  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.ok(created.id);
  assert.equal(created.isActive, true);

  const postDup = await request('POST', '/predefined-pizzas', validBody());
  assert.equal(postDup.status, 409);

  const getRes = await request('GET', `/predefined-pizzas/${created.id}`);
  assert.equal(getRes.status, 200);
  const details = await getRes.json();
  assert.equal(details.product.name, 'Margherita');
  assert.deepEqual(
    details.defaultConfiguration.components.map((c) => c.componentType.name),
    ['Base Dough', 'Base Sauce', 'Cheese'],
  );

  assert.equal((await request('GET', '/predefined-pizzas/abc')).status, 400);
  assert.equal((await request('GET', `/predefined-pizzas/${I.unknown}`)).status, 404);

  const getNameRes = await request('GET', '/predefined-pizzas/name/margherita');
  assert.equal(getNameRes.status, 200);
  assert.equal((await getNameRes.json()).id, created.id);
  assert.equal((await request('GET', '/predefined-pizzas/name/NaoExiste')).status, 404);

  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, {})).status, 400);
  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, { name: 'Outra' })).status, 400);
  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, { isActive: true })).status, 400);

  const putDeactivate = await request('PUT', `/predefined-pizzas/${created.id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);

  assert.equal((await request('GET', `/predefined-pizzas/${created.id}`)).status, 404);
  assert.equal((await request('GET', '/predefined-pizzas/name/Margherita')).status, 404);
});

test('API /predefined-pizzas enforces the default configuration rules', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const cases = [
    ['repeated component', { componentIds: [I.dough, I.sauce, I.cheese, I.cheese] }, 'more than once'],
    ['inactive component', { componentIds: [I.dough, I.sauce, I.inactiveTopping] }, 'active'],
    ['unknown component', { componentIds: [I.dough, I.sauce, I.unknown] }, 'not found'],
    ['below minQuantity (no dough)', { componentIds: [I.sauce, I.cheese] }, 'at least 1'],
    ['above maxQuantity (2 doughs)', { componentIds: [I.dough, I.doughExtra, I.sauce, I.cheese] }, 'at most 1'],
    ['above maxQuantity (2 cheeses)', { componentIds: [I.dough, I.sauce, I.cheese, I.cheeseExtra] }, 'at most 1'],
    ['size without Component Size Configuration', { componentIds: [I.dough, I.sauce, I.toppingNoLarge] }, 'Component Size Configuration'],
    ['inactive size', { sizeIds: [I.sizeSmall, I.sizeInactive] }, 'active'],
    ['product that is not sellable', { productId: I.dough }, 'sellable'],
  ];

  for (const [label, overrides, fragment] of cases) {
    const res = await request('POST', '/predefined-pizzas', validBody(overrides));
    assert.equal(res.status, 400, label);
    const body = await res.json();
    assert.ok(body.error.message.includes(fragment), `${label}: ${body.error.message}`);
  }

  const ok = await request('POST', '/predefined-pizzas', validBody({
    componentIds: [I.dough, I.sauce, I.cheese, I.topping, I.toppingExtra],
  }));
  assert.equal(ok.status, 201);
});

test('API /predefined-pizzas update revalidates the configuration', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const { id } = await (await request('POST', '/predefined-pizzas', validBody())).json();

  const putBad = await request('PUT', `/predefined-pizzas/${id}`, { componentIds: [I.dough, I.sauce, I.inactiveTopping] });
  assert.equal(putBad.status, 400);

  const putOk = await request('PUT', `/predefined-pizzas/${id}`, { componentIds: [I.dough, I.sauce, I.cheeseExtra] });
  assert.equal(putOk.status, 200);
  assert.deepEqual((await putOk.json()).defaultConfiguration.componentIds, [I.dough, I.sauce, I.cheeseExtra]);

  const putSizes = await request('PUT', `/predefined-pizzas/${id}`, { sizeIds: [I.sizeSmall] });
  assert.equal(putSizes.status, 200);
  assert.deepEqual((await putSizes.json()).sizeIds, [I.sizeSmall]);
});

test('API /predefined-pizzas returns only active pizzas and supports search by name', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  await request('POST', '/predefined-pizzas', validBody());
  const postPep = await request('POST', '/predefined-pizzas', validBody({ productId: I.pizzaProduct2 }));
  const pepId = (await postPep.json()).id;

  await request('PUT', `/predefined-pizzas/${pepId}`, { isActive: false });

  const res = await request('GET', '/predefined-pizzas');
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 1);
  assert.equal(list.some((p) => p.id === pepId), false);

  assert.equal((await (await request('GET', '/predefined-pizzas?name=margh')).json()).length, 1);
  assert.equal((await (await request('GET', '/predefined-pizzas?name=pepp')).json()).length, 0);
  assert.equal((await request('GET', '/predefined-pizzas?name=')).status, 400);
});