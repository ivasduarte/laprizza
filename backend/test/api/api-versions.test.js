import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp, loadConfig } from '../../src/index.js';

/**
 * Integration tests: the same API is served under /api/v1 (deprecated) and /api/v2 (current).
 */
async function startServer(t) {
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test_secret' }), {
    databaseHealthProbe: { isHealthy: async () => true },
    versionInfo: { sha: 'unknown' },
  }).listen(0);

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

test('v2 answers without deprecation headers', async (t) => {
  const base = await startServer(t);

  const response = await fetch(`${base}/api/v2/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('deprecation'), null);
  assert.equal(response.headers.get('link'), null);
});

test('v1 still answers, flagged as deprecated with a link to v2', async (t) => {
  const base = await startServer(t);

  const response = await fetch(`${base}/api/v1/health`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('deprecation'), /^@\d+$/);
  assert.equal(response.headers.get('link'), '</api/v2/health>; rel="successor-version"');
});

test('each version serves its own OpenAPI document', async (t) => {
  const base = await startServer(t);

  for (const version of ['v1', 'v2']) {
    const response = await fetch(`${base}/api/${version}/openapi.json`);
    assert.equal(response.status, 200);
    const spec = await response.json();
    assert.deepEqual(spec.servers, [{ url: `/api/${version}` }]);
  }
});

test('an unknown version is a 404', async (t) => {
  const base = await startServer(t);
  assert.equal((await fetch(`${base}/api/v3/health`)).status, 404);
});
