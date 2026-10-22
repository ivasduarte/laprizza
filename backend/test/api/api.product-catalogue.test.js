import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';
const NON_EXISTENT_ID = 'abcdef000000000000000999';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const productsRepo = createDummyProductsRepository();
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    productsRepository: productsRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  await registerUser(
    { email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    usersRepo,
  );
  await registerUser(
    { email: 'customer@laprizza.pt', password: 'StrongPassword123!', role: 'CUSTOMER' },
    usersRepo,
  );

  const prod = await productsRepo.create({
    name: 'Pizza Test',
    description: 'Test',
    price: 10,
    sellable: true,
    stockControlled: false,
  });

  await productsRepo.create({
    name: 'Hidden',
    description: 'Test',
    price: 10,
    sellable: false,
    stockControlled: false,
  });

  return { server, port, productsRepo, prodId: String(prod._id) };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).token;
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

test('API /catalogue RBAC: 401 without Token', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/catalogue')).status, 401);
});

test('API /catalogue accepts CUSTOMER and MANAGER roles', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  assert.equal((await request(port, 'GET', '/catalogue', { token: adminToken })).status, 200);
  assert.equal((await request(port, 'GET', '/catalogue', { token: customerToken })).status, 200);
});

test('API GET /catalogue lists only sellable and active products', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  const res = await request(port, 'GET', '/catalogue', { token: customerToken });
  assert.equal(res.status, 200);

  const items = await res.json();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Pizza Test');
  assert.equal(items[0].sellable, undefined);
  assert.equal(items[0].isActive, undefined);
});

test('API GET /catalogue/:id returns product or 404', async (t) => {
  const { server, port, prodId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const customerToken = await loginAs(port, 'customer@laprizza.pt');

  assert.equal(
    (await request(port, 'GET', `/catalogue/${NON_EXISTENT_ID}`, { token: customerToken })).status,
    404,
  );

  assert.equal(
    (await request(port, 'GET', '/catalogue/id_invalido', { token: customerToken })).status,
    400,
  );

  const res = await request(port, 'GET', `/catalogue/${prodId}`, { token: customerToken });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).name, 'Pizza Test');
});
