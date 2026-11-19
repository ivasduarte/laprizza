import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../../../src/shared/auth/session-store.js';

const SESSION = {
  accessToken: 'token-1',
  user: {
    id: 'u1',
    roles: ['EMPLOYEE'],
    permissions: ['catalogue:read', 'stock:read'],
  },
};
const PROMOTED = {
  id: 'u1',
  roles: ['EMPLOYEE', 'MANAGER'],
  permissions: ['catalogue:read', 'stock:read', 'stock:write'],
};

describe('Session store - current user (WEB03)', () => {
  it('reloadUser replaces the user and keeps the access token', async () => {
    const store = createSessionStore();
    store.start(SESSION);

    assert.equal(await store.reloadUser(async () => PROMOTED), true);

    assert.equal(store.getState().status, 'authenticated');
    assert.deepEqual(store.getState().user, PROMOTED);
    assert.equal(store.getAccessToken(), 'token-1');
  });

  it('notifies subscribers when the user changes', async () => {
    const store = createSessionStore();
    store.start(SESSION);
    let calls = 0;
    store.subscribe(() => calls++);

    await store.reloadUser(async () => PROMOTED);

    assert.equal(calls, 1);
  });

  it('does nothing without a session (no request, no user)', async () => {
    const store = createSessionStore();
    let requests = 0;

    assert.equal(
      await store.reloadUser(async () => (requests++, PROMOTED)),
      false
    );

    assert.equal(requests, 0);
    assert.equal(store.getState().user, null);
  });

  it('shares one request between concurrent reloads', async () => {
    const store = createSessionStore();
    store.start(SESSION);
    let requests = 0;
    const fetchUser = async () => {
      requests++;
      return PROMOTED;
    };

    await Promise.all([
      store.reloadUser(fetchUser),
      store.reloadUser(fetchUser),
    ]);

    assert.equal(requests, 1);
  });

  it('keeps the current user when the request fails', async () => {
    const store = createSessionStore();
    store.start(SESSION);

    const reloaded = await store.reloadUser(async () => {
      throw new Error('network');
    });

    assert.equal(reloaded, false);
    assert.deepEqual(store.getState().user, SESSION.user);
  });

  it('a session that ended meanwhile is not brought back by a late answer', async () => {
    const store = createSessionStore();
    store.start(SESSION);
    let answer;
    const pending = store.reloadUser(
      () => new Promise((resolve) => (answer = resolve))
    );

    store.end();
    answer(PROMOTED);
    await pending;

    assert.equal(store.getState().status, 'anonymous');
    assert.equal(store.getState().user, null);
  });

  it('updateUser ignores empty users and anonymous sessions', () => {
    const store = createSessionStore();
    store.updateUser(PROMOTED);
    assert.equal(store.getState().user, null);

    store.start(SESSION);
    store.updateUser(null);
    assert.deepEqual(store.getState().user, SESSION.user);
  });
});
