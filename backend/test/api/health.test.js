import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp, loadConfig } from '../../src/index.js';

/**
 * Starts the application on an ephemeral port with an injected database probe,
 * so no real MongoDB is needed.
 *
 * @returns {Promise<string>} The URL of GET /api/v1/health.
 */
async function startServer(t, databaseHealthProbe) {
  const server = createApp(
    loadConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'test_secret',
    }),
    { databaseHealthProbe },
  ).listen(0);

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}/api/v1/health`;
}

/**
 * Integration test: Health check endpoint.
 * Bootstraps the application on an ephemeral port and verifies that the GET /api/v1/health
 * endpoint is accessible, returns a 200 OK status, and yields the correct payload structure
 * (status, version string, and a valid ISO 8601 timestamp).
 * The database is reported as reachable by an injected probe.
 */
test('GET /api/v1/health reports the service as ok', async (t) => {
  const url = await startServer(t, { isHealthy: async () => true });

  const response = await fetch(url);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.version, 'string');
  assert.equal(new Date(body.timestamp).toISOString(), body.timestamp);
});

test('GET /api/v1/health is not cached and returns only status, version and timestamp', async (t) => {
  const url = await startServer(t, { isHealthy: async () => true });

  const response = await fetch(url);
  const body = await response.json();

  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(body).sort(), ['status', 'timestamp', 'version']);
});

test('GET /api/v1/health returns 503 unavailable when the database is down', async (t) => {
  const url = await startServer(t, { isHealthy: async () => false });

  const response = await fetch(url);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'unavailable');
  assert.equal(typeof body.version, 'string');
  assert.equal(new Date(body.timestamp).toISOString(), body.timestamp);
  assert.deepEqual(Object.keys(body).sort(), ['status', 'timestamp', 'version']);
});

test('GET /api/v1/health returns 503 without error details when the probe throws', async (t) => {
  const url = await startServer(t, {
    isHealthy: async () => {
      throw new Error('connect ECONNREFUSED mongodb://secret-host:27017');
    },
  });

  const response = await fetch(url);
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.equal(JSON.parse(text).status, 'unavailable');
  assert.ok(!text.includes('ECONNREFUSED'));
  assert.ok(!text.includes('mongodb://'));
});

test('GET /api/v1/health is public (an invalid token is ignored)', async (t) => {
  const url = await startServer(t, { isHealthy: async () => true });

  const response = await fetch(url, { headers: { Authorization: 'Bearer invalid-token' } });

  assert.equal(response.status, 200);
});
