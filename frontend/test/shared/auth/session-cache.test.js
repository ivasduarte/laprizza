import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../../../src/shared/auth/session-store.js';
import { clearCacheWhenSessionEnds } from '../../../src/shared/auth/session-cache.js';

const session = (id) => ({
  accessToken: `token-${id}`,
  user: { id, role: 'MANAGER' },
});

function setup() {
  const store = createSessionStore();
  const calls = [];
  const queryClient = {
    cancelQueries: () => calls.push('cancel'),
    clear: () => calls.push('clear'),
  };
  clearCacheWhenSessionEnds(store, queryClient);
  return { store, calls };
}

describe('Query cache bound to the session (AA04)', () => {
  it('keeps the cache while the session starts or stays the same', () => {
    const { store, calls } = setup();
    store.start(session('u1'));
    store.start(session('u1')); // token refresh, same user
    assert.deepEqual(calls, []);
  });

  it('cancels and clears the cache on logout', () => {
    const { store, calls } = setup();
    store.start(session('u1'));
    store.end();
    assert.deepEqual(calls, ['cancel', 'clear']);
  });

  it('clears the cache when the session expires', () => {
    const { store, calls } = setup();
    store.start(session('u1'));
    store.end({ expired: true });
    assert.deepEqual(calls, ['cancel', 'clear']);
  });

  it('clears the cache when another user takes over', () => {
    const { store, calls } = setup();
    store.start(session('u1'));
    store.start(session('u2'));
    assert.deepEqual(calls, ['cancel', 'clear']);
  });

  it('does not clear when an anonymous visitor stays anonymous', () => {
    const { store, calls } = setup();
    store.beginCheck();
    store.end();
    assert.deepEqual(calls, []);
  });
});
