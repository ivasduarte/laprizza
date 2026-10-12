import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp, loadConfig } from '../src/index.js';

/**
 * Integration test: Health check endpoint.
 * Bootstraps the application on an ephemeral port and verifies that the GET /api/v1/health
 * endpoint is accessible, returns a 200 OK status, and yields the correct payload structure
 * (status, version string, and a valid ISO 8601 timestamp).
 */
test('GET /api/v1/health reports the service as ok', async (t) => {
  const server = createApp(
    loadConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'test_secret',
    }),
  ).listen(0);

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  await once(server, 'listening');

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.version, 'string');
  assert.equal(new Date(body.timestamp).toISOString(), body.timestamp);
});
