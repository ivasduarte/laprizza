import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createRequestLogger } from '../../src/api/middleware/request-logger.js';

/** Sends one request through an app with the request logger and returns what was logged. */
async function logOf(nodeEnv, path, headers = {}) {
  const lines = [];
  const app = express();
  app.use(createRequestLogger(nodeEnv, { stream: { write: (line) => lines.push(line) } }));
  app.get('/api/v1/customers', (_req, res) => res.status(200).json([]));

  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers });
    await res.text();
  } finally {
    server.close();
    server.closeAllConnections();
  }
  await new Promise((resolve) => setImmediate(resolve)); // morgan writes when the response finishes
  return lines.join('');
}

for (const nodeEnv of ['production', 'development']) {
  test(`request log (${nodeEnv}) records the path but never the query string or the Referer`, async () => {
    const line = await logOf(nodeEnv, '/api/v1/customers?search=Maria%20Silva&email=maria@x.pt', {
      Referer: 'http://localhost:4200/customers?search=Maria',
    });

    assert.match(line, /GET \/api\/v1\/customers /);
    assert.ok(!line.includes('Maria'), line);
    assert.ok(!line.includes('search='), line);
    assert.ok(!line.includes('maria@x.pt'), line);
  });
}

test('request log never contains the Authorization header or cookies', async () => {
  const line = await logOf('production', '/api/v1/customers', {
    Authorization: 'Bearer secret.jwt.value',
    Cookie: 'lp_rt=secret-refresh-token',
  });

  assert.match(line, / 200 /);
  assert.ok(!line.includes('secret'), line);
});
