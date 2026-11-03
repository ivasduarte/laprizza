import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import { AuthErrorCode, authError, tooManyAttempts } from '../../src/application/auth/auth-errors.js';
import { assertPasswordPolicy } from '../../src/application/auth/password-policy.js';
import { buildPasswordResetEmail } from '../../src/application/auth/password-reset-email.js';

/**
 * Unit test: AppError keeps status, details, code and is exposable.
 */
test('AppError carries status, details and an optional code', () => {
  const plain = new AppError('Not found', 404);
  assert.equal(plain.status, 404);
  assert.equal(plain.code, null);
  assert.equal(plain.expose, true);

  const coded = new AppError('Validation failed', 400, ['x'], 'VALIDATION_FAILED');
  assert.deepEqual(coded.details, ['x']);
  assert.equal(coded.code, 'VALIDATION_FAILED');
});

/**
 * Unit test: authError uses a neutral default message per code.
 */
test('authError creates an AppError with the code and a default message', () => {
  const err = authError(AuthErrorCode.INVALID_CREDENTIALS, 401);
  assert.ok(err instanceof AppError);
  assert.equal(err.status, 401);
  assert.equal(err.code, 'INVALID_CREDENTIALS');
  assert.equal(err.message, 'Invalid credentials.');
  assert.equal(authError('CUSTOM', 400, 'Custom message').message, 'Custom message');
});

/**
 * Unit test: every code has the same value as its name (stable API contract).
 */
test('AuthErrorCode values equal their keys', () => {
  for (const [key, value] of Object.entries(AuthErrorCode)) assert.equal(value, key);
  assert.ok(Object.isFrozen(AuthErrorCode));
});

/**
 * Unit test: tooManyAttempts rounds up Retry-After to whole seconds (minimum 1).
 */
test('tooManyAttempts sets status 429 and rounds Retry-After up', () => {
  const err = tooManyAttempts(AuthErrorCode.TOO_MANY_ATTEMPTS, 59_001);
  assert.equal(err.status, 429);
  assert.equal(err.code, 'TOO_MANY_ATTEMPTS');
  assert.equal(err.retryAfterSeconds, 60);
  assert.equal(tooManyAttempts(AuthErrorCode.RATE_LIMITED, 0).retryAfterSeconds, 1);
});

/**
 * Unit test: assertPasswordPolicy applies the existing policy with a stable code.
 */
test('assertPasswordPolicy maps policy violations to PASSWORD_POLICY_VIOLATION', () => {
  assert.doesNotThrow(() => assertPasswordPolicy('StrongPassword123!'));
  assert.throws(
    () => assertPasswordPolicy('fraca'),
    (err) => err.status === 400 && err.code === AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  // The message never contains the rejected password
  assert.throws(
    () => assertPasswordPolicy('segredo-fraco'),
    (err) => !err.message.includes('segredo-fraco'),
  );
});

/**
 * Unit test: recovery email in PT and EN, with the link and the expiry filled in.
 */
test('buildPasswordResetEmail fills the link and expiry in both languages', () => {
  const resetUrl = 'http://localhost:4200/reset-password#token=abc';
  const { subject, text } = buildPasswordResetEmail({ resetUrl, expiresInMinutes: 30 });

  assert.ok(subject.includes('LaPrizza'));
  assert.ok(text.includes('nos próximos 30 minutos'));
  assert.ok(text.includes('within 30 minutes'));
  assert.equal(text.split(resetUrl).length - 1, 2);
  assert.ok(!text.includes('${'));
});
