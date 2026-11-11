import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackStore } from '../../../src/shared/feedback/feedback-store.js';

describe('feedback store', () => {
  it('counts pending requests and never goes below zero', () => {
    const store = createFeedbackStore();
    store.beginRequest();
    store.beginRequest();
    store.endRequest();
    assert.equal(store.getState().pending, 1);
    store.endRequest();
    store.endRequest(); // unbalanced call
    assert.equal(store.getState().pending, 0);
  });

  it('notifies subscribers only when the state changes', () => {
    const store = createFeedbackStore();
    const listener = mock.fn();
    const unsubscribe = store.subscribe(listener);
    store.endRequest(); // no-op at zero
    assert.equal(listener.mock.callCount(), 0);
    store.beginRequest();
    assert.equal(listener.mock.callCount(), 1);
    unsubscribe();
    store.beginRequest();
    assert.equal(listener.mock.callCount(), 1);
  });

  it('keeps a stable state reference between changes (useSyncExternalStore)', () => {
    const store = createFeedbackStore();
    assert.equal(store.getState(), store.getState());
  });

  it('adds toasts with type-specific auto-dismiss and dedupes by key', () => {
    const store = createFeedbackStore();
    const success = store.notify({ type: 'success', messageKey: 'a.saved' });
    const again = store.notify({ type: 'success', messageKey: 'a.saved' });
    const error = store.notify({ type: 'error', messageKey: 'a.failed' });

    assert.equal(success, again);
    const [first, second] = store.getState().toasts;
    assert.equal(first.autoDismissMs, 5000);
    assert.equal(second.autoDismissMs, null); // errors stay until dismissed
    assert.equal(store.getState().toasts.length, 2);
    assert.notEqual(success, error);
  });

  it('keeps at most 4 toasts (oldest dropped) and dismisses by id', () => {
    const store = createFeedbackStore();
    for (let i = 0; i < 6; i += 1)
      store.notify({ type: 'info', messageKey: `k${i}` });
    const { toasts } = store.getState();
    assert.equal(toasts.length, 4);
    assert.equal(toasts[0].messageKey, 'k2');

    store.dismiss(toasts[0].id);
    assert.equal(store.getState().toasts.length, 3);
    store.dismiss('does-not-exist');
    assert.equal(store.getState().toasts.length, 3);
  });
});
