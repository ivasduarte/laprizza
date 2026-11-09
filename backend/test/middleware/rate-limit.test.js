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
