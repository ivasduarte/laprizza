import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuard } from '../../../src/shared/auth/guard.js';

describe('Route guard with permissions (WEB03)', () => {
  it('an authenticated user without the page permission gets "denied", not the login page', () => {
    assert.equal(
      resolveGuard('authenticated', { requiresAuth: true, allowed: false }),
      'denied'
    );
  });

  it('an authenticated user with the page permission gets the page', () => {
    assert.equal(
      resolveGuard('authenticated', { requiresAuth: true, allowed: true }),
      'allow'
    );
  });

  it('a visitor without a session goes to the login page, whatever the permission', () => {
    assert.equal(
      resolveGuard('anonymous', { requiresAuth: true, allowed: false }),
      'login'
    );
    assert.equal(
      resolveGuard('anonymous', { requiresAuth: true, allowed: true }),
      'login'
    );
  });

  it('a public page with a Guest permission opens without a session', () => {
    assert.equal(
      resolveGuard('anonymous', { requiresAuth: false, allowed: true }),
      'allow'
    );
  });

  it('a public page whose permission the Guest lacks asks for a login', () => {
    assert.equal(
      resolveGuard('anonymous', { requiresAuth: false, allowed: false }),
      'login'
    );
  });

  it('never decides while the session is being restored', () => {
    for (const status of ['unknown', 'loading']) {
      assert.equal(
        resolveGuard(status, { requiresAuth: true, allowed: true }),
        'wait',
        status
      );
      assert.equal(
        resolveGuard(status, { requiresAuth: false, allowed: false }),
        'wait',
        status
      );
    }
  });

  it('keeps the AA04 behaviour when called without page options', () => {
    assert.equal(resolveGuard('authenticated'), 'allow');
    assert.equal(resolveGuard('anonymous'), 'login');
  });
});
