import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorText, KNOWN_AUTH_ERRORS } from '../../../src/shared/auth/auth-error.js';
import { parseCallbackParams, CALLBACK_ERROR_CODES } from '../../../src/shared/auth/external-auth.js';

const t = (key) => key; // returns the key, so the test checks which text is used

test('AA03: local login shows its own access-denied text for accounts without an active role', () => {
  assert.ok(KNOWN_AUTH_ERRORS.includes('NO_ACTIVE_ROLE'));
  assert.equal(authErrorText(t, { status: 403, code: 'NO_ACTIVE_ROLE' }), 'auth.errors.NO_ACTIVE_ROLE');
  assert.equal(authErrorText(t, { status: 503, code: 'ROLES_UNAVAILABLE' }), 'auth.errors.ROLES_UNAVAILABLE');
});

test('AA03: the external login callback keeps the same codes (same rule for both methods)', () => {
  for (const code of ['NO_ACTIVE_ROLE', 'ROLES_UNAVAILABLE']) {
    assert.ok(CALLBACK_ERROR_CODES.includes(code));
    assert.deepEqual(parseCallbackParams(new URLSearchParams({ status: 'error', code })), {
      status: 'error',
      code,
    });
  }
});
