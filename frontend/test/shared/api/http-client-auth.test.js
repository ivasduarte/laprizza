import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  createHttpClient,
} from '../../../src/shared/api/http-client.js';

const BASE = 'http://localhost:3000/api/v1';

function jsonResponse(status, body, headers = {}) {
  const all = { 'content-type': 'application/json', ...headers };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => all[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

const apiError = (status, code) => ({
  error: { status, code, message: code },
});

describe('HTTP client - authentication (AA01)', () => {
  it('exposes the API error code and Retry-After', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () =>
        jsonResponse(429, apiError(429, 'TOO_MANY_ATTEMPTS'), {
          'retry-after': '60',
        }),
    });

    await assert.rejects(client.post('/auth/login', {}), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'TOO_MANY_ATTEMPTS');
      assert.equal(error.retryAfterSeconds, 60);
      return true;
    });
  });

  it('does not send the token when auth is false and forwards credentials', async () => {
    let calledOptions;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      fetchFn: async (url, options) => {
        calledOptions = options;
        return jsonResponse(200, {});
      },
    });

    await client.post(
      '/auth/login',
      {},
      { auth: false, credentials: 'include' }
    );

    assert.equal(calledOptions.headers.Authorization, undefined);
    assert.equal(calledOptions.credentials, 'include');
  });

  it('refreshes once on TOKEN_EXPIRED and repeats the request with the new token', async () => {
    let token = 'old';
    const calls = [];
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => token,
      refreshAccessToken: async () => {
        token = 'new';
        return true;
      },
      fetchFn: async (url, options) => {
        calls.push(options.headers.Authorization);
        return options.headers.Authorization === 'Bearer new'
          ? jsonResponse(200, ['ok'])
          : jsonResponse(401, apiError(401, 'TOKEN_EXPIRED'));
      },
    });

    assert.deepEqual(await client.get('/users'), ['ok']);
    assert.deepEqual(calls, ['Bearer old', 'Bearer new']);
  });

  it('ends the session when the refresh fails', async () => {
    let expired = 0;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'old',
      refreshAccessToken: async () => false,
      onSessionExpired: () => expired++,
      fetchFn: async () => jsonResponse(401, apiError(401, 'TOKEN_EXPIRED')),
    });

    await assert.rejects(client.get('/users'), (error) => error.status === 401);
    assert.equal(expired, 1);
  });

  it('ends the session on other 401 codes without refreshing', async () => {
    let refreshed = 0;
    let expired = 0;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      refreshAccessToken: async () => {
        refreshed++;
        return true;
      },
      onSessionExpired: () => expired++,
      fetchFn: async () => jsonResponse(401, apiError(401, 'SESSION_REVOKED')),
    });

    await assert.rejects(client.get('/users'));
    assert.equal(refreshed, 0);
    assert.equal(expired, 1);
  });

  it('does not treat a failed login (no token) as an expired session', async () => {
    let expired = 0;
    const client = createHttpClient({
      baseUrl: BASE,
      onSessionExpired: () => expired++,
      fetchFn: async () =>
        jsonResponse(401, apiError(401, 'INVALID_CREDENTIALS')),
    });

    await assert.rejects(
      client.post('/auth/login', {}, { auth: false }),
      (error) => error.code === 'INVALID_CREDENTIALS'
    );
    assert.equal(expired, 0);
  });
});
