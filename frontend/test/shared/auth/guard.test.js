import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuard } from '../../../src/shared/auth/guard.js';

describe('Route guard decision (AA04)', () => {
  it('allows only an authenticated session', () => {
    assert.equal(resolveGuard('authenticated'), 'allow');
  });

  it('sends anonymous visitors (logout, expiry, never logged in) to login', () => {
    assert.equal(resolveGuard('anonymous'), 'login');
  });

  it('waits while the session is being restored, never granting access', () => {
    assert.equal(resolveGuard('unknown'), 'wait');
    assert.equal(resolveGuard('loading'), 'wait');
  });

  it('AA02: sends a customer page to the phone form while the account has no phone', () => {
    const page = { requiresContactPhone: true, allowed: false };
    assert.equal(resolveGuard('authenticated', { ...page, phoneRequired: true }), 'phone');
    assert.equal(resolveGuard('authenticated', { ...page, phoneRequired: false }), 'denied');
    assert.equal(resolveGuard('anonymous', { ...page, phoneRequired: true }), 'login');
    assert.equal(resolveGuard('authenticated', { phoneRequired: true }), 'allow'); // other pages
  });

  it('fails closed for any unexpected status', () => {
    assert.equal(resolveGuard(undefined), 'wait');
    assert.equal(resolveGuard('admin'), 'wait');
  });
});
