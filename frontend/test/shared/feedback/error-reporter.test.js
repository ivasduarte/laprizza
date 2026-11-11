import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../../src/shared/api/http-client.js';
import { createErrorReporter } from '../../../src/shared/feedback/error-reporter.js';

function setup() {
  const store = { notify: mock.fn() };
  return { store, report: createErrorReporter({ store }) };
}

describe('error reporter policy', () => {
  it('toasts network, timeout, 5xx and 403', () => {
    const { store, report } = setup();
    [
      new ApiError('x', { status: 0, code: 'NETWORK_ERROR' }),
      new ApiError('x', { status: 0, code: 'TIMEOUT' }),
      new ApiError('x', { status: 500 }),
      new ApiError('x', { status: 403 }),
    ].forEach((error) => report(error));
    assert.equal(store.notify.mock.callCount(), 4);
    assert.equal(store.notify.mock.calls[0].arguments[0].type, 'error');
  });

  it('leaves 400, 401, 404, 409 and 429 to the screen that made the request', () => {
    const { store, report } = setup();
    [400, 401, 404, 409, 429].forEach((status) =>
      report(new ApiError('x', { status }))
    );
    assert.equal(store.notify.mock.callCount(), 0);
  });

  it('ignores aborts and silent requests', () => {
    const { store, report } = setup();
    report(new DOMException('x', 'AbortError'));
    report(new ApiError('x', { status: 500 }), { feedback: 'silent' });
    assert.equal(store.notify.mock.callCount(), 0);
  });

  it('dedupes by kind and code', () => {
    const { store, report } = setup();
    report(new ApiError('x', { status: 500, code: 'A' }));
    report(new ApiError('x', { status: 500, code: 'B' }));
    const keys = store.notify.mock.calls.map(
      (call) => call.arguments[0].dedupeKey
    );
    assert.deepEqual(keys, ['error:server:A', 'error:server:B']);
  });
});
