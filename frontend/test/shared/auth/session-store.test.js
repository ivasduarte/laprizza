import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../../../src/shared/auth/session-store.js';

const SESSION = {
  accessToken: 'token-1',
  user: { id: 'u1', email: 'a@laprizza.pt', role: 'MANAGER' },
};

describe('Session store', () => {
  it('starts unknown and checks the session only once', () => {
    const store = createSessionStore();
    assert.equal(store.getState().status, 'unknown');
    assert.equal(store.beginCheck(), true);
    assert.equal(store.getState().status, 'loading');
    assert.equal(store.beginCheck(), false);
  });

  it('keeps the access token in memory and notifies listeners', () => {
    const store = createSessionStore();
    let notified = 0;
    store.subscribe(() => notified++);

    store.start(SESSION);

    assert.equal(store.getAccessToken(), 'token-1');
    assert.equal(store.getState().status, 'authenticated');
    assert.deepEqual(store.getState().user, SESSION.user);
    assert.equal(notified, 1);
  });

  it('clears the token on end and flags expired sessions', () => {
    const store = createSessionStore();
    store.start(SESSION);

    store.end({ expired: true });

    assert.equal(store.getAccessToken(), null);
    assert.deepEqual(store.getState(), {
      status: 'anonymous',
      user: null,
      expired: true,
    });
  });

  it('shares one refresh request between concurrent calls', async () => {
    const store = createSessionStore();
    let calls = 0;
    const fetchSession = async () => {
      calls++;
      return SESSION;
    };

    const results = await Promise.all([
      store.refresh(fetchSession),
      store.refresh(fetchSession),
      store.refresh(fetchSession),
    ]);

    assert.deepEqual(results, [true, true, true]);
    assert.equal(calls, 1);
    assert.equal(store.getAccessToken(), 'token-1');
  });

  it('returns false when the refresh fails', async () => {
    const store = createSessionStore();
    const ok = await store.refresh(async () => {
      throw new Error('401');
    });
    assert.equal(ok, false);
    assert.equal(store.getAccessToken(), null);
  });
});
