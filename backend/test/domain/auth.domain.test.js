import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthenticationDenial,
  evaluateAuthentication,
  computeLockoutDelayMs,
  remainingLockoutMs,
  isSessionUsable,
} from '../../src/domain/auth/auth.domain.js';

const POLICY = { threshold: 3, stepsMs: [60_000, 300_000, 1_800_000] };
const NOW = new Date('2026-11-02T10:00:00.000Z');

/**
 * Unit test: evaluateAuthentication.
 * Only ACTIVE accounts may open a session; the other states return their own reason.
 */
test('evaluateAuthentication allows only active accounts', () => {
  assert.deepEqual(evaluateAuthentication({ status: 'active' }), { allowed: true });
  assert.deepEqual(evaluateAuthentication({ status: 'inactive' }), {
    allowed: false,
    reason: AuthenticationDenial.ACCOUNT_INACTIVE,
  });
  assert.deepEqual(evaluateAuthentication({ status: 'disabled' }), {
    allowed: false,
    reason: AuthenticationDenial.ACCOUNT_DISABLED,
  });
});

/**
 * Unit test: evaluateAuthentication (defensive).
 * An unknown state or a missing user is never allowed (fail closed).
 */
test('evaluateAuthentication denies unknown status and missing user', () => {
  assert.equal(evaluateAuthentication({}).allowed, false);
  assert.equal(evaluateAuthentication({ status: 'whatever' }).allowed, false);
  assert.equal(evaluateAuthentication(undefined).allowed, false);
});

/**
 * Unit test: denial codes match the API contract.
 */
test('AuthenticationDenial codes match the API error codes', () => {
  assert.equal(AuthenticationDenial.ACCOUNT_INACTIVE, 'ACCOUNT_INACTIVE');
  assert.equal(AuthenticationDenial.ACCOUNT_DISABLED, 'ACCOUNT_DISABLED');
});

/**
 * Unit test: computeLockoutDelayMs.
 * 1st/2nd failure: no wait; 3rd: 1 min; 4th: 5 min; 5th onwards: 30 min (maximum).
 */
test('computeLockoutDelayMs applies the progressive steps with a maximum', () => {
  assert.equal(computeLockoutDelayMs(0, POLICY), 0);
  assert.equal(computeLockoutDelayMs(1, POLICY), 0);
  assert.equal(computeLockoutDelayMs(2, POLICY), 0);
  assert.equal(computeLockoutDelayMs(3, POLICY), 60_000);
  assert.equal(computeLockoutDelayMs(4, POLICY), 300_000);
  assert.equal(computeLockoutDelayMs(5, POLICY), 1_800_000);
  assert.equal(computeLockoutDelayMs(50, POLICY), 1_800_000);
});

/**
 * Unit test: computeLockoutDelayMs with no steps configured never blocks.
 */
test('computeLockoutDelayMs returns 0 when no steps are configured', () => {
  assert.equal(computeLockoutDelayMs(10, { threshold: 3, stepsMs: [] }), 0);
});

/**
 * Unit test: remainingLockoutMs.
 */
test('remainingLockoutMs returns the remaining wait or 0', () => {
  assert.equal(remainingLockoutMs(null, NOW), 0);
  assert.equal(remainingLockoutMs(undefined, NOW), 0);
  assert.equal(remainingLockoutMs(new Date(NOW.getTime() - 1000), NOW), 0);
  assert.equal(remainingLockoutMs(new Date(NOW.getTime() + 45_000), NOW), 45_000);
  // Accepts dates serialized as strings (e.g. from .lean())
  assert.equal(remainingLockoutMs(new Date(NOW.getTime() + 1000).toISOString(), NOW), 1000);
});

/**
 * Unit test: isSessionUsable.
 * The session must exist, not be revoked and not be expired.
 */
test('isSessionUsable checks existence, revocation and expiry', () => {
  const future = new Date(NOW.getTime() + 60_000);
  const past = new Date(NOW.getTime() - 1);

  assert.equal(isSessionUsable({ revokedAt: null, expiresAt: future }, NOW), true);
  assert.equal(isSessionUsable(null, NOW), false);
  assert.equal(isSessionUsable({ revokedAt: NOW, expiresAt: future }, NOW), false);
  assert.equal(isSessionUsable({ revokedAt: null, expiresAt: past }, NOW), false);
  assert.equal(isSessionUsable({ revokedAt: null, expiresAt: NOW }, NOW), false);
});
