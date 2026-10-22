import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyAllergenRepository } from '../infrastructure/allergens.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const allergenRepo = createDummyAllergenRepository();
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    usersRepository: usersRepo,
    allergenRepository: allergenRepo,
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

  return { server, port, allergenRepo };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'StrongPassword123!' }),
  });
  const { token } = await res.json();
  return (method, path, body) =>
    fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

test('API /allergens RBAC: Only MANAGER can create and update', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/allergens', { name: 'Gluten' });
  assert.equal(postEmp.status, 403);

  const postMgr = await managerRequest('POST', '/allergens', { name: 'Gluten' });
  assert.equal(postMgr.status, 201);
});

test('API /allergens lifecycle and validations', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postBad = await request('POST', '/allergens', {});
  assert.equal(postBad.status, 400);

  const postRes = await request('POST', '/allergens', { name: 'Amendoim' });
  assert.equal(postRes.status, 201);
  const { id } = await postRes.json();

  const postDup = await request('POST', '/allergens', { name: 'amendoim' });
  assert.equal(postDup.status, 409);

  const getRes = await request('GET', `/allergens/${id}`);
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).name, 'Amendoim');

  const getNameRes = await request('GET', `/allergens/name/Amendoim`);
  assert.equal(getNameRes.status, 200);

  const putBad = await request('PUT', `/allergens/${id}`, { name: 'Outro' });
  assert.equal(putBad.status, 400);

  const putDeactivate = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);

  const getDeactivated = await request('GET', `/allergens/${id}`);
  assert.equal(getDeactivated.status, 404);
});

test('API /allergens prevents deactivation if referenced', async (t) => {
  const { server, port, allergenRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const postRes = await request('POST', '/allergens', { name: 'Lactose' });
  const { id } = await postRes.json();

  allergenRepo._setReferenced(id);

  const putDeactivate = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivate.status, 409);

  const responseBody = await putDeactivate.json();
  assert.ok(responseBody.error.message.includes('referenced'));

  allergenRepo._removeReference(id);
  const putDeactivateSuccess = await request('PUT', `/allergens/${id}`, { isActive: false });
  assert.equal(putDeactivateSuccess.status, 200);
});

test('API /allergens returns a complete list of all active allergens', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  await request('POST', '/allergens', { name: 'Peanut' });

  const postMustard = await request('POST', '/allergens', { name: 'Mustard' });
  const idToDeactivate = (await postMustard.json()).id;

  await request('PUT', `/allergens/${idToDeactivate}`, { isActive: false });

  const res = await request('GET', '/allergens');
  assert.equal(res.status, 200);

  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);

  const hasMustard = list.some((a) => a.name === 'Mustard');
  assert.equal(hasMustard, false);

  const hasPeanut = list.some((a) => a.name === 'Peanut');
  assert.equal(hasPeanut, true);
});
