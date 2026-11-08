import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

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

const SIZE_ID = 'd0d0d0000000000000000001';

async function setupTestServer() {
  // No size exists until a test programs one.
  const sizeRepo = {
    listPizzaSizes: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    create: mock.fn(async (data) => ({ _id: SIZE_ID, isActive: true, ...data })),
    update: mock.fn(async (id, data) => ({ _id: id, name: 'Large', isActive: true, ...data })),
  };
  const productsRepo = {
    existsWithSizeConfigurationForPizzaSize: mock.fn(async () => false),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    sizeRepository: sizeRepo,
    productsRepository: productsRepo,
  }).listen(0);
  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, sizeRepo, productsRepo };
}

/** Programs the size repository so that `size` is the only stored size. */
function storeSize(sizeRepo, size) {
  sizeRepo.findById.mock.mockImplementation(async (id) => (String(id) === size._id ? size : null));
  sizeRepo.update.mock.mockImplementation(async (_id, data) => ({ ...size, ...data }));
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
  const { server, port, sizeRepo } = await setupTestServer();
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
  assert.equal(sizeRepo.create.mock.callCount(), 0);

  // 201 Created
  const postRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Small' }),
  });
  assert.equal(postRes.status, 201);
  assert.equal(sizeRepo.create.mock.calls[0].arguments[0].name, 'Small');

  // 409 Conflict (Duplicado): the unique index rejects the second insert
  sizeRepo.create.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { name: 1 } });
  });
  const postDup = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Small' }),
  });
  assert.equal(postDup.status, 409);
});

test('API GET and PATCH /pizza-size/:id handles formats, 404s and updates', async (t) => {
  const { server, port, sizeRepo } = await setupTestServer();
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
  storeSize(sizeRepo, { _id: id, name: 'Large', isActive: true });

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
  assert.deepEqual(sizeRepo.update.mock.calls.at(-1).arguments, [id, { isActive: false }]);
});

test('API PATCH /pizza-size/:id refuses to deactivate a size used by a size configuration', async (t) => {
  const { server, port, sizeRepo, productsRepo } = await setupTestServer();
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

  storeSize(sizeRepo, { _id: id, name: 'Large', isActive: true });
  // A product has a size configuration for this size.
  productsRepo.existsWithSizeConfigurationForPizzaSize.mock.mockImplementation(
    async (pizzaSizeId) => pizzaSizeId === id,
  );

  // 409 Conflict (tamanho usado por uma configuração)
  const patchRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(patchRes.status, 409);
  assert.equal(sizeRepo.update.mock.callCount(), 0);

  // Continua ativo
  const getRes = await fetch(`http://127.0.0.1:${port}/api/v1/pizza-size/${id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal((await getRes.json()).isActive, true);
});