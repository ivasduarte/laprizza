import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

const PASSWORD = 'StrongPassword123!';
const USER = {
  _id: 'abcdef0000000000000000b1',
  email: 'manager.ratelimit@laprizza.pt',
  roles: ['MANAGER'],
  status: 'active',
  passwordHash: await passwordHasher.hash(PASSWORD),
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
};

/**
 * Real app with the login limit set to 2 failed attempts per IP.
 * Failed attempts use an invalid body (400): they never reach the repositories, so the
 * per-account lockout (AA01) does not interfere with the per-IP limiter under test.
 */
async function startServer() {
  const infra = {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(async (email) => (email === USER.email ? USER : null)),
      findById: mock.fn(async () => USER),
      clearLoginFailures: mock.fn(async () => {}),
    },
    sessionsRepository: { create: mock.fn(async (data) => ({ _id: 'session-1', ...data })) },
    securityLogger: { log: mock.fn() },
  };
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test',
    RATE_LIMIT_ENABLED: 'true',
    AUTH_RATE_LIMIT_MAX: '2',
  });
  const server = createApp(config, infra).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const auth = `http://127.0.0.1:${server.address().port}/api/v2/auth`;
  const post = async (path, body) =>
    (
      await fetch(`${auth}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    ).status;

  return {
    failLogin: () => post('/login', {}),
    goodLogin: () => post('/login', { email: USER.email, password: PASSWORD }),
    refresh: () => post('/refresh', {}),
    close: () => {
      server.close();
      server.closeAllConnections();
    },
  };
}

test('only failed logins count, and a successful login resets the counter of the IP', async (t) => {
  const { failLogin, goodLogin, close } = await startServer();
  t.after(close);

  assert.equal(await failLogin(), 400);
  assert.equal(await goodLogin(), 200); // not counted, and forgives the failure above
  assert.equal(await goodLogin(), 200);
  assert.equal(await failLogin(), 400);
  assert.equal(await failLogin(), 400);
  assert.equal(await failLogin(), 429); // third failure in a row
});

test('page reloads (refresh) never spend login attempts and are not limited', async (t) => {
  const { failLogin, refresh, close } = await startServer();
  t.after(close);

  for (let i = 0; i < 6; i += 1) assert.equal(await refresh(), 401); // no cookie: anonymous
  assert.equal(await failLogin(), 400);
  assert.equal(await failLogin(), 400);
  assert.equal(await failLogin(), 429);
});
