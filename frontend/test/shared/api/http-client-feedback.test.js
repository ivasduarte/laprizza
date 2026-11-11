import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  createHttpClient,
} from '../../../src/shared/api/http-client.js';
import { createFeedbackStore } from '../../../src/shared/feedback/feedback-store.js';
import { createErrorReporter } from '../../../src/shared/feedback/error-reporter.js';
import { getHttpTimeouts } from '../../../src/shared/api/timeouts.js';

const BASE = 'http://localhost:3000/api/v1';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

/** fetch that never answers; it only settles when the request is aborted. */
const hangingFetch = (_url, { signal }) =>
  new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () =>
      reject(new DOMException('Aborted', 'AbortError'))
    );
  });

afterEach(() => mock.timers.reset());

describe('HTTP client - loading counter (WEB04)', () => {
  it('increments on start and decrements on success', async () => {
    const onRequestStart = mock.fn();
    const onRequestEnd = mock.fn();
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () => jsonResponse(200, {}),
      onRequestStart,
      onRequestEnd,
    });

    await client.get('/x');

    assert.equal(onRequestStart.mock.callCount(), 1);
    assert.equal(onRequestEnd.mock.callCount(), 1);
    assert.deepEqual(onRequestStart.mock.calls[0].arguments[0], {
      method: 'GET',
      path: '/x',
      feedback: 'auto',
    });
  });

  it('decrements on HTTP failure, network failure and caller abort', async () => {
    const store = createFeedbackStore();
    const responses = [
      async () =>
        jsonResponse(500, {
          error: { status: 500, code: 'INTERNAL_SERVER_ERROR' },
        }),
      async () => {
        throw new TypeError('fetch failed');
      },
      hangingFetch,
    ];
    for (const fetchFn of responses) {
      const client = createHttpClient({
        baseUrl: BASE,
        fetchFn,
        onRequestStart: () => store.beginRequest(),
        onRequestEnd: () => store.endRequest(),
      });
      const controller = new AbortController();
      const pending = client.get('/x', { signal: controller.signal });
      controller.abort();
      await assert.rejects(pending);
    }
    assert.equal(store.getState().pending, 0);
  });

  it('a throwing hook never breaks the request', async () => {
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: async () => jsonResponse(200, { ok: true }),
      onRequestStart: () => {
        throw new Error('hook bug');
      },
      onRequestEnd: () => {
        throw new Error('hook bug');
      },
    });
    assert.deepEqual(await client.get('/x'), { ok: true });
  });

  it('counts a request once even when the session is refreshed and the call retried', async () => {
    const onRequestStart = mock.fn();
    const onRequestEnd = mock.fn();
    const responses = [
      jsonResponse(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } }),
      jsonResponse(200, { ok: true }),
    ];
    const client = createHttpClient({
      baseUrl: BASE,
      getToken: () => 'abc',
      refreshAccessToken: async () => true,
      fetchFn: async () => responses.shift(),
      onRequestStart,
      onRequestEnd,
    });

    await client.get('/x');

    assert.equal(onRequestStart.mock.callCount(), 1);
    assert.equal(onRequestEnd.mock.callCount(), 1);
  });
});

describe('HTTP client - timeouts (WEB04)', () => {
  it('aborts a hanging read after the read timeout with code TIMEOUT', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: hangingFetch,
      timeoutMs: 15_000,
    });

    const pending = client.get('/x');
    mock.timers.tick(14_999);
    mock.timers.tick(1);

    await assert.rejects(pending, (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'TIMEOUT');
      assert.equal(error.status, 0);
      assert.equal(error.outcomeUnknown, false); // a read can be repeated freely
      return true;
    });
  });

  it('marks a timed-out write as unknown outcome and uses the longer write timeout', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: hangingFetch,
      timeoutMs: 15_000,
      mutationTimeoutMs: 30_000,
    });

    const pending = client.post('/x', {});
    mock.timers.tick(15_000); // read limit passed: a write is still waiting
    let settled = false;
    pending.catch(() => {}).finally(() => (settled = true));
    await Promise.resolve();
    assert.equal(settled, false);

    mock.timers.tick(15_000);
    await assert.rejects(pending, (error) => {
      assert.equal(error.code, 'TIMEOUT');
      assert.equal(error.outcomeUnknown, true);
      return true;
    });
  });

  it('flags a network failure of a write as unknown outcome, but not of a read', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed');
    };
    const client = createHttpClient({ baseUrl: BASE, fetchFn: failing });

    await assert.rejects(
      client.post('/x', {}),
      (e) => e.code === 'NETWORK_ERROR' && e.outcomeUnknown
    );
    await assert.rejects(
      client.get('/x'),
      (e) => e.code === 'NETWORK_ERROR' && !e.outcomeUnknown
    );
  });

  it('lets a per-request timeout override the default', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: hangingFetch,
      timeoutMs: 60_000,
    });
    const pending = client.get('/x', { timeoutMs: 1000 });
    mock.timers.tick(1000);
    await assert.rejects(pending, (error) => error.code === 'TIMEOUT');
  });

  it('does not report a caller abort as an error', async () => {
    const onError = mock.fn();
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn: hangingFetch,
      onError,
    });
    const controller = new AbortController();
    const pending = client.get('/x', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, (error) => error.name === 'AbortError');
    assert.equal(onError.mock.callCount(), 0);
  });

  it('reads timeouts from the environment with safe fallbacks', () => {
    assert.deepEqual(getHttpTimeouts({}), {
      timeoutMs: 15_000,
      mutationTimeoutMs: 30_000,
    });
    assert.deepEqual(
      getHttpTimeouts({
        VITE_HTTP_TIMEOUT_MS: '5000',
        VITE_HTTP_MUTATION_TIMEOUT_MS: '9000',
      }),
      { timeoutMs: 5000, mutationTimeoutMs: 9000 }
    );
    assert.deepEqual(
      getHttpTimeouts({
        VITE_HTTP_TIMEOUT_MS: 'abc',
        VITE_HTTP_MUTATION_TIMEOUT_MS: '-1',
      }),
      { timeoutMs: 15_000, mutationTimeoutMs: 30_000 }
    );
  });
});

describe('HTTP client + error reporter (WEB04 test strategy)', () => {
  function setup(fetchFn) {
    const store = createFeedbackStore();
    const notify = mock.method(store, 'notify');
    const report = createErrorReporter({ store });
    const client = createHttpClient({
      baseUrl: BASE,
      fetchFn,
      onRequestStart: () => store.beginRequest(),
      onRequestEnd: () => store.endRequest(),
      onError: report,
    });
    return { store, notify, client };
  }

  it('a 500 with internal details becomes one sanitized toast', async () => {
    const stack = 'TypeError: x is not a function\n    at /srv/app/db.js:42:13';
    const { store, notify, client } = setup(async () =>
      jsonResponse(500, {
        error: { status: 500, code: 'X', message: stack, details: [stack] },
      })
    );

    await assert.rejects(client.get('/x'));

    assert.equal(notify.mock.callCount(), 1);
    const [toast] = store.getState().toasts;
    assert.equal(toast.type, 'error');
    assert.equal(toast.error.kind, 'server');
    assert.equal(
      JSON.stringify(store.getState()).includes('/srv/app/db.js'),
      false
    );
    assert.equal(store.getState().pending, 0);
  });

  it('a 400 validation error is left to the form (no toast)', async () => {
    const { notify, client } = setup(async () =>
      jsonResponse(400, {
        error: {
          status: 400,
          code: 'BAD_REQUEST',
          details: [{ field: 'name', type: 'any.required', message: 'x' }],
        },
      })
    );
    await assert.rejects(
      client.post('/x', {}),
      (error) => error.status === 400
    );
    assert.equal(notify.mock.callCount(), 0);
  });

  it('repeated failures of the same kind do not stack toasts', async () => {
    const { store, client } = setup(async () => {
      throw new TypeError('fetch failed');
    });
    for (let i = 0; i < 3; i += 1) await assert.rejects(client.get('/x'));
    assert.equal(store.getState().toasts.length, 1);
  });

  it("feedback: 'silent' keeps the failure out of the toasts", async () => {
    const { notify, client } = setup(async () => jsonResponse(503, {}));
    await assert.rejects(client.get('/x', { feedback: 'silent' }));
    assert.equal(notify.mock.callCount(), 0);
  });
});
