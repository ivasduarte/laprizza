import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyAuthInfrastructure } from '../infrastructure/auth.dummy.dependencies.js';
import { createDummyPizzaSizeRepository } from '../infrastructure/pizza-size.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const sizeRepo = createDummyPizzaSizeRepository();
  const productsRepo = createDummyProductsRepository();
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createDummyAuthInfrastructure(),
    usersRepository: usersRepo,
    sizeRepository: sizeRepo,
    productsRepository: productsRepo,
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

  return { server, port, productsRepo };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).accessToken;
}

test('API POST /pizza-size enforces Joi, RBAC and Conflicts', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const empToken = await loginAs(port, 'emp@laprizza.pt');

  // 401 Unauthorized (Sem token)
  assert.equal(
    (await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, { method: 'POST' })).status,
    401,
  );

  // 403 Forbidden (EMPLOYEE bloqueado)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Small' }),
      })
    ).status,
    403,
  );

  // 400 Bad Request (Joi: falta name)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).status,
    400,
  );

  // 201 Created
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Small' }),
  });
  assert.equal(postRes.status, 201);

  // 409 Conflict (Duplicado)
  const postDup = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Small' }),
  });
  assert.equal(postDup.status, 409);
});

test('API GET and PATCH /pizza-size/:id handles formats, 404s and updates', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  // Criar registo inicial
  const createRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Large' }),
  });
  const id = (await createRes.json()).id;

  // 400 Bad Request (Formato MongoDB ObjectId inválido bloqueado pelo Joi)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/abc`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    400,
  );

  // 404 Not Found (Formato válido mas não existe)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/abcdef000000000000000999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).status,
    404,
  );

  // 200 OK (GET)
  const getRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 200);

  // 400 Bad Request (PATCH Vazio)
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).status,
    400,
  );

  // 200 OK (PATCH desativar)
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(patchRes.status, 200);
  assert.equal((await patchRes.json()).isActive, false);
});

test('API PATCH /pizza-size/:id refuses to deactivate a size used by a size configuration', async (t) => {
  const { server, port, productsRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const createRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Large' }),
  });
  const id = (await createRes.json()).id;

  await productsRepo.create({
    name: 'Mozzarella',
    description: 'Cheese',
    pizzaComponentTypeId: 'type1',
    sizeConfigurations: [{ pizzaSizeId: id, price: 1.5, stockUnitsConsumed: null }],
  });

  // 409 Conflict (tamanho usado por uma configuração)
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(patchRes.status, 409);

  // Continua ativo
  const getRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal((await getRes.json()).isActive, true);
});