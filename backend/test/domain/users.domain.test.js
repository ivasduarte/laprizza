import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordStrength } from '../../src/domain/users/users.domain.js';

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