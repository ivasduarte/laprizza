import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../../src/shared/api/http-client.js';
import { createSubmitGuard } from '../../../src/shared/forms/submit-guard.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('submit guard (duplicate submission)', () => {
  it('runs the action once while it is in progress, even for synchronous double clicks', async () => {
    const guard = createSubmitGuard();
    const gate = deferred();
    const action = mock.fn(() => gate.promise);

    const first = guard.run(action);
    const second = guard.run(action); // same tick: React state would not be updated yet
    assert.equal(guard.isBusy(), true);
    assert.deepEqual(await second, { ok: false, skipped: true });

    gate.resolve('saved');
    assert.deepEqual(await first, { ok: true, value: 'saved' });
    assert.equal(action.mock.callCount(), 1);
  });

  it('is released after success and after failure', async () => {
    const guard = createSubmitGuard();
    await guard.run(async () => 1);
    assert.equal(guard.isBusy(), false);
    await guard.run(async () => {
      throw new ApiError('x', { status: 500 });
    });
    assert.equal(guard.isBusy(), false);
    assert.equal((await guard.run(async () => 2)).value, 2);
  });

  it('resolves failures as a normalized error instead of throwing', async () => {
    const guard = createSubmitGuard();
    const result = await guard.run(async () => {
      throw new ApiError('Validation failed', {
        status: 400,
        details: [{ field: 'name', type: 'any.required', message: 'x' }],
      });
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.kind, 'validation');
    assert.deepEqual(result.error.fieldErrors, [
      { field: 'name', type: 'any.required' },
    ]);
  });

  it('treats aborts as neutral and reports programming errors', async () => {
    const onUnexpected = mock.fn();
    const guard = createSubmitGuard({ onUnexpected });

    const aborted = await guard.run(async () => {
      throw new DOMException('x', 'AbortError');
    });
    assert.deepEqual(aborted, { ok: false, aborted: true });
    assert.equal(onUnexpected.mock.callCount(), 0);

    await guard.run(async () => {
      throw new TypeError('bug');
    });
    assert.equal(onUnexpected.mock.callCount(), 1);
  });
});
