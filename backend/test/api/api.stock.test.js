import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyStockRepository } from '../infrastructure/stock.dummy.repository.js';
import { registerUser } from '../../src/application/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const productsRepo = createDummyProductsRepository();
  const stockRepo = createDummyStockRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    productsRepository: productsRepo,
    stockRepository: stockRepo,
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

  const prodWithStock = await productsRepo.create({
    name: 'Stocked',
    description: 'x',
    stockControlled: true,
  });
  const prodNoStock = await productsRepo.create({
    name: 'NoStock',
    description: 'y',
    stockControlled: false,
  });

  return {
    server,
    port,
    prodWithStockId: String(prodWithStock._id),
    prodNoStockId: String(prodNoStock._id),
  };
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

test('API /stock RBAC: 401 without Token', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/stock')).status, 401);
});

test('API /stock accepts MANAGER and EMPLOYEE roles', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const empToken = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await request(port, 'GET', '/stock', { token: adminToken })).status, 200);
  assert.equal((await request(port, 'GET', '/stock', { token: empToken })).status, 200);
});

test('API GET and PATCH /stock/:productId Joi validations and Business Rules', async (t) => {
  const { server, port, prodWithStockId, prodNoStockId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  assert.equal((await request(port, 'GET', '/stock/abc', { token: adminToken })).status, 400);

  assert.equal(
    (await request(port, 'GET', `/stock/${prodNoStockId}`, { token: adminToken })).status,
    400,
  );

  const getRes = await request(port, 'GET', `/stock/${prodWithStockId}`, { token: adminToken });
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).quantity, 0);

  assert.equal(
    (await request(port, 'PATCH', `/stock/${prodWithStockId}`, { token: adminToken, body: {} }))
      .status,
    400,
  );

  assert.equal(
    (
      await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
        token: adminToken,
        body: { amount: -5, operation: 'increase' },
      })
    ).status,
    400,
  );

  assert.equal(
    (
      await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
        token: adminToken,
        body: { amount: 10, operation: 'add' },
      })
    ).status,
    400,
  );

  const patchInc = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 15, operation: 'increase' },
  });
  assert.equal(patchInc.status, 200);
  assert.equal((await patchInc.json()).quantity, 15);

  const patchDec = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 5, operation: 'decrease' },
  });
  assert.equal(patchDec.status, 200);
  assert.equal((await patchDec.json()).quantity, 10);

  const patchNeg = await request(port, 'PATCH', `/stock/${prodWithStockId}`, {
    token: adminToken,
    body: { amount: 20, operation: 'decrease' },
  });
  assert.equal(patchNeg.status, 400);
});
