import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createRateLimiter, passThrough } from '../../src/api/middleware/rate-limit.js';
import { errorHandler } from '../../src/api/middleware/error-handler.js';

/**
 * Starts a minimal app with a limit of 2 requests per minute.
 * @returns {Promise<{url: string, logger: object, close: () => void}>}
 */
async function startLimitedServer() {
  const logger = { log: mock.fn() };
  const app = express();
  app.use(createRateLimiter({ name: 'test', windowMs: 60_000, limit: 2, securityLogger: logger }));
  app.post('/login', (_req, res) => res.status(204).end());
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}/login`,
    logger,
    close: () => {
      server.close();
      server.closeAllConnections();
    },
  };
}

/**
 * Unit test: above the limit -> 429 RATE_LIMITED with Retry-After and an AA05 log entry.
 */
test('createRateLimiter answers 429 RATE_LIMITED after the limit', async (t) => {
  const { url, logger, close } = await startLimitedServer();
  t.after(close);

  assert.equal((await fetch(url, { method: 'POST' })).status, 204);
  assert.equal((await fetch(url, { method: 'POST' })).status, 204);

  const blocked = await fetch(url, { method: 'POST' });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  const retryAfter = Number(blocked.headers.get('retry-after'));
  assert.ok(retryAfter >= 1 && retryAfter <= 60);

  assert.equal(logger.log.mock.callCount(), 1);
  const [event, details] = logger.log.mock.calls[0].arguments;
  assert.equal(event, 'RATE_LIMITED');
  assert.equal(details.limiter, 'test');
});

/**
 * Unit test: passThrough (limits disabled) always calls next() with no error.
 */
test('passThrough calls next without an error', () => {
  const next = mock.fn();
  passThrough({}, {}, next);
  assert.equal(next.mock.callCount(), 1);
  assert.deepEqual(next.mock.calls[0].arguments, []);
});

/**
 * Unit test (AA05): requests for which `skip` returns true are not counted.
 */
test('createRateLimiter does not count skipped requests', async (t) => {
  const logger = { log: mock.fn() };
  const app = express();
  app.use(
    createRateLimiter({
      name: 'public',
      windowMs: 60_000,
      limit: 1,
      securityLogger: logger,
      skip: (req) => Boolean(req.headers.authorization),
    }),
  );
  app.get('/catalogue', (_req, res) => res.status(204).end());
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const url = `http://127.0.0.1:${server.address().port}/catalogue`;
  const withToken = { headers: { Authorization: 'Bearer anything' } };

  assert.equal((await fetch(url)).status, 204);
  assert.equal((await fetch(url)).status, 429); // anonymous: limit reached
  assert.equal((await fetch(url, withToken)).status, 204); // skipped, never limited
  assert.equal((await fetch(url, withToken)).status, 204);
  assert.equal(logger.log.mock.callCount(), 1);
});

/**
 * Starts an app whose /attempt answers 204 or 401 (?ok=1 succeeds), behind a limiter of 2.
 * @param {object} options - Extra createRateLimiter options.
 */
async function startAttemptServer(options) {
  const app = express();
  app.use(
    createRateLimiter({
      name: 'login',
      windowMs: 60_000,
      limit: 2,
      securityLogger: { log: mock.fn() },
      ...options,
    }),
  );
  app.post('/attempt', (req, res) => res.status(req.query.ok ? 204 : 401).end());
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/attempt`;
  return {
    ok: async () => (await fetch(`${base}?ok=1`, { method: 'POST' })).status,
    fail: async () => (await fetch(base, { method: 'POST' })).status,
    close: () => {
      server.close();
      server.closeAllConnections();
    },
  };
}

/**
 * Unit test (login limiter): successful requests never count; only failures are limited.
 */
test('countOnlyFailures: successful requests are never limited', async (t) => {
  const { ok, fail, close } = await startAttemptServer({ countOnlyFailures: true });
  t.after(close);

  for (let i = 0; i < 5; i += 1) assert.equal(await ok(), 204);
  assert.equal(await fail(), 401);
  assert.equal(await fail(), 401);
  assert.equal(await fail(), 429); // third failure in the window
});

/**
 * Unit test (login limiter): without resetOnSuccess a success does not forgive earlier failures.
 */
test('countOnlyFailures without resetOnSuccess keeps earlier failures', async (t) => {
  const { ok, fail, close } = await startAttemptServer({ countOnlyFailures: true });
  t.after(close);

  assert.equal(await fail(), 401);
  assert.equal(await ok(), 204);
  assert.equal(await fail(), 401);
  assert.equal(await fail(), 429);
});

/**
 * Unit test (login limiter): a success resets the counter of that client to 0.
 */
test('resetOnSuccess: a success forgives the previous failures', async (t) => {
  const { ok, fail, close } = await startAttemptServer({
    countOnlyFailures: true,
    resetOnSuccess: true,
  });
  t.after(close);

  assert.equal(await fail(), 401);
  assert.equal(await ok(), 204); // counter back to 0
  assert.equal(await fail(), 401);
  assert.equal(await fail(), 401);
  assert.equal(await fail(), 429); // only now two failures in a row were exceeded
});

/**
 * Unit test: once blocked, a request is refused before the route runs (no reset by a 429).
 */
test('resetOnSuccess: a blocked client stays blocked', async (t) => {
  const { ok, fail, close } = await startAttemptServer({
    countOnlyFailures: true,
    resetOnSuccess: true,
  });
  t.after(close);

  await fail();
  await fail();
  assert.equal(await fail(), 429);
  assert.equal(await ok(), 429); // the right password does not bypass the IP block
});
