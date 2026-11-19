import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGuestPermissionStore } from '../../../src/shared/auth/guest-permissions.js';

describe('Guest permissions store (WEB03)', () => {
  it('starts empty until the back end answers (fail closed)', () => {
    assert.deepEqual(createGuestPermissionStore().get(), []);
  });

  it('keeps a frozen copy of what it receives', () => {
    const store = createGuestPermissionStore();
    const received = ['catalogue:read'];

    store.set(received);
    received.push('stock:write');

    assert.deepEqual(store.get(), ['catalogue:read']);
    assert.ok(Object.isFrozen(store.get()));
  });

  it('ignores invalid answers', () => {
    const store = createGuestPermissionStore();
    store.set(['catalogue:read']);
    store.set({ permissions: ['stock:write'] });
    assert.deepEqual(store.get(), []);
  });

  it('returns the same snapshot until it changes (required by useSyncExternalStore)', () => {
    const store = createGuestPermissionStore();
    store.set(['catalogue:read']);
    assert.equal(store.get(), store.get());
  });

  it('notifies subscribers on every change and stops after unsubscribing', () => {
    const store = createGuestPermissionStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);

    store.set(['catalogue:read']);
    unsubscribe();
    store.set([]);

    assert.equal(calls, 1);
  });
});
