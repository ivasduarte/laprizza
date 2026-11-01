import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkBackendHealth, getApiBaseUrl } from './health.js';

describe('Health API client', () => {
  it('returns the default base URL without trailing slash when env is empty', () => {
    const url = getApiBaseUrl({});
    assert.equal(url, 'http://localhost:8080/api/v1');
  });

  it('returns true when the backend health endpoint responds with ok', async () => {
    const dummyHttpClientOk = async (url, options) => {
      assert.equal(url, 'http://localhost:8080/api/v1/health');
      assert.equal(options.method, 'GET');
      return { ok: true, status: 200 };
    };

    const isHealthy = await checkBackendHealth(
      dummyHttpClientOk,
      'http://localhost:8080/api/v1'
    );
    assert.equal(isHealthy, true);
  });

  it('returns false when the backend health endpoint fails or is unreachable', async () => {
    const dummyHttpClientUnreachable = async () => {
      throw new Error('Network error');
    };

    const isHealthy = await checkBackendHealth(
      dummyHttpClientUnreachable,
      'http://localhost:8080/api/v1'
    );
    assert.equal(isHealthy, false);
  });
});