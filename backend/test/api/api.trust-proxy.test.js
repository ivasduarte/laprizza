import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';

/**
 * Starts the real app with the auth rate limit set to 1 request per window.
 * @param {Record<string, string>} env - Extra environment variables.
 */
async function startServer(env = {}) {
  // The login body is invalid ({}), so the requests never reach the repositories.
  const infra = {
    usersRepository: { findByEmailWithPasswordHash: mock.fn(async () => null) },
    securityLogger: { log: mock.fn() },
  };
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test',
    RATE_LIMIT_ENABLED: 'true',
    AUTH_RATE_LIMIT_MAX: '1',
    ...env,
  });
  const app = createApp(config, infra);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const url = `http://127.0.0.1:${server.address().port}/api/v1/auth/login`;
  return {
    app,
    logger: infra.securityLogger,
    usersRepository: infra.usersRepository,
    login: (forwardedFor) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
        body: '{}',
      }),
    close: () => {
      server.close();
      server.closeAllConnections();
    },
  };
}

/**
 * Integration test: with TRUST_PROXY=1 (one nginx in front), req.ip and the AA01 rate limit
 * use the client IP from X-Forwarded-For, not the proxy address 127.0.0.1.
 */
test('TRUST_PROXY=1 rate-limits by the client IP sent by the proxy', async (t) => {
  const { app, logger, usersRepository, login, close } = await startServer({ TRUST_PROXY: '1' });
  t.after(close);

  assert.equal(app.get('trust proxy'), 1);

  // Client A uses its single request, then gets blocked.
  assert.notEqual((await login('203.0.113.10')).status, 429);
  assert.equal((await login('203.0.113.10')).status, 429);

  // The block is recorded against the client IP, not the proxy's.
  const [event, details] = logger.log.mock.calls.at(-1).arguments;
  assert.equal(event, 'RATE_LIMITED');
  assert.equal(details.ip, '203.0.113.10');

  // Client B behind the same proxy has its own counter.
  assert.notEqual((await login('203.0.113.20')).status, 429);

  // A client-supplied value is ignored: only the rightmost entry (appended by nginx) counts.
  assert.equal((await login('198.51.100.1, 203.0.113.10')).status, 429);
  assert.equal(usersRepository.findByEmailWithPasswordHash.mock.callCount(), 0);
});

/**
 * Integration test (control): without TRUST_PROXY, every client behind the proxy shares one counter.
 */
test('without TRUST_PROXY all clients share the proxy IP', async (t) => {
  const { app, login, close } = await startServer();
  t.after(close);

  assert.equal(app.get('trust proxy'), false);
  assert.notEqual((await login('203.0.113.10')).status, 429);
  assert.equal((await login('203.0.113.20')).status, 429);
});
