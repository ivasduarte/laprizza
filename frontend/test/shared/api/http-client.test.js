import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  createHttpClient,
} from '../../../src/shared/api/http-client.js';

const BASE = 'http://localhost:3000/api/v1';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('HTTP client', () => {
  it('builds the URL and skips empty query parameters', async () => {
    let calledUrl;
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async (url) => {
        calledUrl = url;
        return jsonResponse(200, []);
      },
    });

    await client.get('/catalogue', {
      query: { search: 'pizza', categoryId: '', other: undefined },
    });

    assert.equal(calledUrl, `${BASE}/catalogue?search=pizza`);
  });

  it('sends the bearer token and JSON body when available', async () => {
    let calledOptions;
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      fetchFn: async (url, options) => {
        calledOptions = options;
        return jsonResponse(201, { id: '1' });
      },
    });

    const result = await client.post('/allergens', { name: 'Gluten' });

    assert.deepEqual(result, { id: '1' });
    assert.equal(calledOptions.method, 'POST');
    assert.equal(calledOptions.headers.Authorization, 'Bearer abc');
    assert.equal(calledOptions.headers['Content-Type'], 'application/json');
    assert.equal(calledOptions.body, '{"name":"Gluten"}');
  });

  it('does not send Authorization when there is no token', async () => {
    let calledOptions;
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async (url, options) => {
        calledOptions = options;
        return jsonResponse(200, {});
      },
    });

    await client.get('/health');

    assert.equal(calledOptions.headers.Authorization, undefined);
  });

  it('returns null for 204 responses', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () => ({
        ok: true,
        status: 204,
        headers: { get: () => '' },
      }),
    });

    assert.equal(await client.delete('/allergens/1'), null);
  });

  it('throws ApiError with status and message on failure responses', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () => jsonResponse(400, { message: 'Invalid name' }),
    });

    await assert.rejects(client.get('/x'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.message, 'Invalid name');
      return true;
    });
  });

  it('throws ApiError with status 0 when the server is unreachable', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await assert.rejects(client.get('/x'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 0);
      return true;
    });
  });
});
