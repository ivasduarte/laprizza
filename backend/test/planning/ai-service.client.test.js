import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAiServiceClient } from '../../src/infrastructure/ai-service/ai-service.client.js';

const request = { scenarioId: 'DEMO-PARTIAL', stockMode: 'scenario' };
const snapshot = { meta: { snapshotId: 'abc' } };
const silent = { error: () => {} };

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const client = (fetchImpl, extra = {}) =>
  createAiServiceClient({
    baseUrl: 'http://ai:5000/',
    apiKey: 'k'.repeat(32),
    fetchImpl,
    logger: silent,
    ...extra,
  });

describe('AI service client (AI05)', () => {
  it('posts request and snapshot with the service key, never a user token', async () => {
    const fetchImpl = mock.fn(async () => jsonResponse(200, { status: 'ok', simulation: true }));
    const result = await client(fetchImpl).calculate('bom', request, snapshot);

    assert.equal(result.status, 'ok');
    const [url, init] = fetchImpl.mock.calls[0].arguments;
    assert.equal(url, 'http://ai:5000/service/bom');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['X-Api-Key'], 'k'.repeat(32));
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), { request, snapshot });
  });

  it('keeps the 422 of the AI service (missing information)', async () => {
    const details = { problems: [{ code: 'MISSING_SCENARIO_STOCK' }] };
    const fetchImpl = async () =>
      jsonResponse(422, { error: { status: 422, code: 'AI_INVALID_DATA', message: 'x', details } });
    await assert.rejects(client(fetchImpl).calculate('requirements', request, snapshot), (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, 'AI_INVALID_DATA');
      assert.deepEqual(err.details, details);
      return true;
    });
  });

  it('maps a refused connection to 503 with Retry-After', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(client(fetchImpl).calculate('bom', request, snapshot), (err) => {
      assert.equal(err.status, 503);
      assert.equal(err.details.reason, 'connection_failed');
      assert.equal(err.retryAfterSeconds, 5);
      return true;
    });
  });

  it('maps a timeout to 504', async () => {
    // AbortSignal.timeout() timers are unref'd: the pending timer keeps the event loop alive.
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        const keepAlive = setTimeout(() => {}, 1_000);
        signal.addEventListener('abort', () => {
          clearTimeout(keepAlive);
          reject(signal.reason);
        });
      });
    await assert.rejects(
      client(fetchImpl, { timeoutMs: 20 }).calculate('bom', request, snapshot),
      (err) => err.status === 504 && err.details.reason === 'timeout',
    );
  });

  it('maps a rejected service key to 503 (configuration problem, not the user)', async () => {
    const fetchImpl = async () => jsonResponse(401, { error: { code: 'SERVICE_UNAUTHORIZED' } });
    await assert.rejects(
      client(fetchImpl).calculate('bom', request, snapshot),
      (err) => err.status === 503 && err.details.reason === 'service_auth_failed',
    );
  });

  it('maps a non-JSON answer to 503', async () => {
    const fetchImpl = async () => new Response('<html>', { status: 502 });
    await assert.rejects(
      client(fetchImpl).calculate('bom', request, snapshot),
      (err) => err.status === 503 && err.details.reason === 'invalid_ai_response',
    );
  });

  it('answers 503 without calling the AI service when the key is not configured', async () => {
    const fetchImpl = mock.fn();
    await assert.rejects(
      client(fetchImpl, { apiKey: undefined }).calculate('bom', request, snapshot),
      (err) => err.status === 503 && err.details.reason === 'not_configured',
    );
    assert.equal(fetchImpl.mock.callCount(), 0);
  });

  it('rejects unknown calculations', async () => {
    await assert.rejects(client(mock.fn()).calculate('stock', request, snapshot), /Unknown AI calculation/);
  });
});
