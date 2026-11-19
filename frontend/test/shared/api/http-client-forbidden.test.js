import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpClient } from '../../../src/shared/api/http-client.js';

const BASE = 'http://localhost:3000/api/v2';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => body,
  };
}

const forbidden = () =>
  jsonResponse(403, {
    error: { status: 403, code: 'FORBIDDEN', message: 'Forbidden.' },
  });

describe('HTTP client - 403 for an authenticated request (WEB03)', () => {
  it('notifies onForbidden (so the session reloads its permissions) and still rejects', async () => {
    const notified = [];
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      fetchFn: async () => forbidden(),
      onForbidden: (error) => notified.push(error),
    });

    await assert.rejects(
      client.get('/stock'),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    assert.equal(notified.length, 1);
    assert.equal(notified[0].code, 'FORBIDDEN');
  });

  it('does not notify for requests without a session', async () => {
    let notified = 0;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => null,
      fetchFn: async () => forbidden(),
      onForbidden: () => notified++,
    });

    await assert.rejects(client.get('/stock'));
    assert.equal(notified, 0);
  });

  it('does not notify for other errors', async () => {
    let notified = 0;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      fetchFn: async () =>
        jsonResponse(404, { error: { status: 404, code: 'NOT_FOUND' } }),
      onForbidden: () => notified++,
    });

    await assert.rejects(client.get('/stock/abc'));
    assert.equal(notified, 0);
  });

  it('a failing onForbidden never changes the error of the request', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      fetchFn: async () => forbidden(),
      onForbidden: () => {
        throw new Error('listener bug');
      },
    });

    await assert.rejects(client.get('/stock'), (err) => err.status === 403);
  });
});
