import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePasswordStrength,
  AccountStatus,
  statusFromIsActive,
  normalizeEmail,
} from '../../src/domain/users/users.domain.js';

/**
 * Unit test: validatePasswordStrength domain function.
 * Verifies password strength boundaries and constraints.
 * Ensures that passwords strictly adhere to the 8 to 64 character length limits,
 * require at least one uppercase letter, and require at least one special character.
 */
test('Password boundaries and rules', () => {
  assert.throws(() => validatePasswordStrength('A!12345'), /Invalid Password/);
  assert.doesNotThrow(() => validatePasswordStrength('Aa!12345'));
  assert.throws(() => validatePasswordStrength('aa!12345'), /Invalid Password/);
  assert.throws(() => validatePasswordStrength('AaB12345'), /Invalid Password/);
  assert.doesNotThrow(() => validatePasswordStrength('A!' + 'a'.repeat(62)));
  assert.throws(() => validatePasswordStrength('A!' + 'a'.repeat(63)), /Invalid Password/);
});

/**
 * Unit test: AccountStatus.
 * The three states exist with the values stored in the database and the object is immutable.
 */
test('AccountStatus exposes the three immutable states', () => {
  assert.deepEqual(Object.values(AccountStatus).sort(), ['active', 'disabled', 'inactive']);
  assert.ok(Object.isFrozen(AccountStatus));
});

/**
 * Unit test: statusFromIsActive.
 * isActive=false (Manager's decision) means DISABLED, never INACTIVE (invitation).
 */
test('statusFromIsActive maps the Sprint 1 flag to a status', () => {
  assert.equal(statusFromIsActive(true), AccountStatus.ACTIVE);
  assert.equal(statusFromIsActive(false), AccountStatus.DISABLED);
});

/**
 * Unit test: normalizeEmail.
 * Removes spaces at the ends and converts to lowercase; non-strings give ''.
 */
test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Admin@LaPrizza.PT '), 'admin@laprizza.pt');
  assert.equal(normalizeEmail('user@laprizza.pt'), 'user@laprizza.pt');
  assert.equal(normalizeEmail(undefined), '');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(42), '');
});
