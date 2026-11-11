import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmStore } from '../../../src/shared/feedback/confirm-store.js';

describe('confirm store', () => {
  it('resolves true on confirm and false on cancel', async () => {
    const store = createConfirmStore();

    const yes = store.request({ messageKey: 'a' });
    assert.equal(store.getState().current.messageKey, 'a');
    store.confirm();
    assert.equal(await yes, true);
    assert.equal(store.getState().current, null);

    const no = store.request({ messageKey: 'b' });
    store.cancel();
    assert.equal(await no, false);
  });

  it('queues requests: one dialog at a time, in order', async () => {
    const store = createConfirmStore();
    const first = store.request({ messageKey: 'first' });
    const second = store.request({ messageKey: 'second' });

    assert.equal(store.getState().current.messageKey, 'first');
    store.cancel();
    assert.equal(await first, false);
    assert.equal(store.getState().current.messageKey, 'second');
    store.confirm();
    assert.equal(await second, true);
  });

  it('ignores confirm/cancel when nothing is open', () => {
    const store = createConfirmStore();
    assert.doesNotThrow(() => {
      store.confirm();
      store.cancel();
    });
  });
});
