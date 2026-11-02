import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import {
  createDummyAiDataRepository,
  SEED_IDS,
} from '../infrastructure/ai-data.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

async function setupTestServer(aiDataRepository = createDummyAiDataRepository()) {
  const usersRepo = createDummyUsersRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    aiDataRepository,
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

  return { server, port };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).token;
}

function request(port, method, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`http://127.0.0.1:${port}/api/v1${path}`, { method, headers });
}

test('API /ai-data/snapshot RBAC: 401 without token, 403 for EMPLOYEE, 200 for MANAGER', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  assert.equal((await request(port, 'GET', '/ai-data/snapshot')).status, 401);

  const empToken = await loginAs(port, 'emp@laprizza.pt');
  assert.equal((await request(port, 'GET', '/ai-data/snapshot', { token: empToken })).status, 403);

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  assert.equal(
    (await request(port, 'GET', '/ai-data/snapshot', { token: adminToken })).status,
    200,
  );
});

test('API /ai-data/snapshot returns the planning data for the knowledge base', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  const body = await res.json();

  assert.match(body.meta.snapshotId, /^[0-9a-f]{16}$/);
  assert.equal(body.meta.simulated, false);
  assert.equal(body.sizes.length, 2);

  // Only stock-controlled components are in the BOM.
  assert.equal(body.bom.length, 4);
  assert.ok(!body.bom.some((b) => b.componentId === SEED_IDS.basil));
  assert.deepEqual(
    body.bom.find((b) => b.sizeId === SEED_IDS.medium && b.componentId === SEED_IDS.cheese),
    {
      pizzaId: SEED_IDS.margherita,
      sizeId: SEED_IDS.medium,
      componentId: SEED_IDS.cheese,
      quantity: 2,
    },
  );

  assert.deepEqual(body.stock, [
    { productId: SEED_IDS.dough, quantity: 40 },
    { productId: SEED_IDS.cheese, quantity: 25 },
  ]);
  assert.deepEqual(body.issues, []);
});

test('API /ai-data/snapshot does not expose customer data', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const res = await request(port, 'GET', '/ai-data/snapshot', { token: adminToken });
  assert.ok(!(await res.text()).includes('leak@x.pt'));
});

test('API /ai-data/snapshot reports data problems in issues instead of inventing values', async (t) => {
  const repo = createDummyAiDataRepository();
  const products = await repo.listProducts();
  products.find((p) => p._id === SEED_IDS.cheese).sizeConfigurations = [];

  const { server, port } = await setupTestServer(repo);
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const body = await (
    await request(port, 'GET', '/ai-data/snapshot', { token: adminToken })
  ).json();

  assert.ok(!body.bom.some((b) => b.componentId === SEED_IDS.cheese));
  assert.equal(body.issues.filter((i) => i.code === 'MISSING_OR_INVALID_STOCK_UNITS').length, 2);
});
