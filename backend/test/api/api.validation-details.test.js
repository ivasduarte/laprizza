import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const MANAGER = {
  _id: 'abcdef000000000000000001',
  email: 'admin@laprizza.pt',
  role: 'MANAGER',
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
};

/** Mocked users/sessions repositories: just enough to log in through the API. */
function createAuthMocks() {
  return {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(async (email) =>
        email === MANAGER.email ? MANAGER : null,
      ),
      findById: mock.fn(async (id) => (String(id) === MANAGER._id ? MANAGER : null)),
    },
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(async (id) => ({
        _id: id,
        userId: id,
        tokenVersion: 0,
        expiresAt: new Date(Date.now() + 3_600_000),
        revokedAt: null,
      })),
    },
    securityLogger: { log: mock.fn() },
  };
}

async function setup() {
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    sizeRepository: {
      listPizzaSizes: mock.fn(async () => []),
      findById: mock.fn(async () => null),
      create: mock.fn(),
      update: mock.fn(),
    },
    productsRepository: { existsWithSizeConfigurationForPizzaSize: mock.fn(async () => false) },
  }).listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MANAGER.email, password: PASSWORD }),
  });
  return { server, base, token: (await login.json()).accessToken };
}

test('400 responses expose structured details [{ field, type, message }]', async (t) => {
  const { server, base, token } = await setup();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const res = await fetch(`${base}/pizza-size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
  const nameError = body.error.details.find((d) => d.field === 'name');
  assert.ok(nameError, 'a detail is bound to the "name" input');
  assert.equal(nameError.type, 'any.required');
  assert.equal(typeof nameError.message, 'string');
});

test('auth validation keeps its VALIDATION_FAILED code and structured details', async (t) => {
  const { server, base } = await setup();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  const fields = Object.fromEntries(body.error.details.map((d) => [d.field, d.type]));
  assert.equal(fields.email, 'string.email');
  assert.equal(fields.password, 'any.required');
});
