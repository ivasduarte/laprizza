import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authApi } from '../../../src/shared/auth/auth-api.js';
import { guestPermissionStore } from '../../../src/shared/auth/guest-permissions.js';
import { sessionStore } from '../../../src/shared/auth/session-store.js';

const realFetch = globalThis.fetch;

/** Replaces fetch with a stub that records the requests and answers with `status`/`body`. */
function stubFetch(status, body) {
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name) =>
          name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      json: async () => body,
    };
  };
  return requests;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  guestPermissionStore.set([]);
  sessionStore.end();
});

describe('authApi - Guest permissions (WEB03)', () => {
  it('loads what the back end grants to visitors without a session', async () => {
    const requests = stubFetch(200, { permissions: ['catalogue:read'] });

    await authApi.loadGuestPermissions();

    assert.deepEqual(guestPermissionStore.get(), ['catalogue:read']);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/auth\/guest-permissions$/);
    assert.equal(requests[0].headers.Authorization, undefined);
  });

  it('keeps the list empty when the request fails (fail closed)', async () => {
    guestPermissionStore.set(['catalogue:read']);
    globalThis.fetch = async () => {
      throw new TypeError('network down');
    };

    await authApi.loadGuestPermissions();

    assert.deepEqual(guestPermissionStore.get(), []);
  });

  it('ignores an unexpected answer', async () => {
    stubFetch(200, { permissions: 'catalogue:read' });
    await authApi.loadGuestPermissions();
    assert.deepEqual(guestPermissionStore.get(), []);
  });
});

describe('authApi - reload the current user (WEB03)', () => {
  it('asks /auth/me with the session token and updates the user', async () => {
    sessionStore.start({
      accessToken: 'token-1',
      user: { id: 'u1', roles: ['EMPLOYEE'], permissions: ['stock:read'] },
    });
    const promoted = {
      id: 'u1',
      roles: ['EMPLOYEE', 'MANAGER'],
      permissions: ['stock:read', 'stock:write'],
    };
    const requests = stubFetch(200, promoted);

    assert.equal(await authApi.reloadUser(), true);

    assert.match(requests[0].url, /\/auth\/me$/);
    assert.equal(requests[0].headers.Authorization, 'Bearer token-1');
    assert.deepEqual(sessionStore.getState().user, promoted);
  });

  it('does nothing without a session', async () => {
    const requests = stubFetch(200, {});
    assert.equal(await authApi.reloadUser(), false);
    assert.equal(requests.length, 0);
  });

  it('a revoked session (401) ends the session instead of keeping stale permissions', async () => {
    sessionStore.start({
      accessToken: 'token-1',
      user: { id: 'u1', roles: ['MANAGER'], permissions: ['stock:write'] },
    });
    stubFetch(401, {
      error: { status: 401, code: 'SESSION_REVOKED', message: 'revoked' },
    });

    assert.equal(await authApi.reloadUser(), false);

    assert.equal(sessionStore.getState().status, 'anonymous');
    assert.equal(sessionStore.getState().user, null);
  });
});
