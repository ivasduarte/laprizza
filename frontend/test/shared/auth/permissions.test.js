import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  effectivePermissions,
} from '../../../src/shared/auth/permissions.js';

const GUEST = Object.freeze(['catalogue:read']);
const MANAGER_USER = {
  id: 'u1',
  roles: ['MANAGER'],
  permissions: ['catalogue:read', 'stock:read', 'stock:write'],
};

describe('Effective permissions (WEB03)', () => {
  it('an authenticated user has the permissions of their session', () => {
    const state = { status: 'authenticated', user: MANAGER_USER };
    assert.deepEqual(
      effectivePermissions(state, GUEST),
      MANAGER_USER.permissions
    );
  });

  it('a visitor without a session has the Guest permissions', () => {
    assert.equal(
      effectivePermissions({ status: 'anonymous', user: null }, GUEST),
      GUEST
    );
  });

  it('while the session is being checked only the Guest permissions apply', () => {
    for (const status of ['unknown', 'loading']) {
      assert.equal(
        effectivePermissions({ status, user: null }, GUEST),
        GUEST,
        status
      );
    }
  });

  it('fails closed: no Guest permissions loaded, or a user without permissions', () => {
    assert.deepEqual(
      effectivePermissions({ status: 'anonymous', user: null }),
      []
    );
    assert.deepEqual(
      effectivePermissions({ status: 'authenticated', user: { id: 'u2' } }),
      []
    );
    assert.deepEqual(effectivePermissions(undefined), []);
  });

  it('never trusts a user object outside an authenticated session', () => {
    const stale = { status: 'anonymous', user: MANAGER_USER };
    assert.equal(effectivePermissions(stale, GUEST), GUEST);
  });
});

describe('can (WEB03)', () => {
  it('allows only the permissions that were granted', () => {
    assert.equal(can(MANAGER_USER.permissions, 'stock:write'), true);
    assert.equal(can(GUEST, 'stock:write'), false);
  });

  it('treats a missing requirement as public', () => {
    assert.equal(can([], null), true);
    assert.equal(can([], undefined), true);
  });

  it('fails closed on invalid permission lists', () => {
    assert.equal(can(undefined, 'catalogue:read'), false);
    assert.equal(can(null, 'catalogue:read'), false);
    assert.equal(can('catalogue:read', 'catalogue:read'), false);
  });
});
