import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoneNumber, validateAddress, normalizePhoneNumber } from '../../src/domain/customers/customers.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

process.env.JWT_SECRET = 'test_secret_key';

/**
 * Unit test: validatePhoneNumber domain function.
 * Exhaustive boundary testing for PT phone formats.
 */
test('validatePhoneNumber validates strictly Portuguese formats', () => {
  // Valid cases
  assert.equal(validatePhoneNumber('912345678'), true);
  assert.equal(validatePhoneNumber('223456789'), true);
  assert.equal(validatePhoneNumber('+351912345678'), true);
  assert.equal(validatePhoneNumber('00351912345678'), true);
  assert.equal(validatePhoneNumber('351912345678'), true);
  assert.equal(validatePhoneNumber('912 345 678'), true); // spacing allowed

  // Invalid formats (length, prefixes, data types)
  assert.equal(validatePhoneNumber('999999999'), false, 'Invalid prefix 99');
  assert.equal(validatePhoneNumber('123456789'), false, 'Starts with 1');
  assert.equal(validatePhoneNumber('91234567'), false, 'Too short');
  assert.equal(validatePhoneNumber('9123456789'), false, 'Too long');
  assert.equal(validatePhoneNumber(''), false, 'Empty string');
  assert.equal(validatePhoneNumber(null), false, 'Null data type');
  assert.equal(validatePhoneNumber(912345678), false, 'Number data type instead of string');
});

test('normalizePhoneNumber returns the 9 national digits or null', () => {
  assert.equal(normalizePhoneNumber('912345678'), '912345678');
  assert.equal(normalizePhoneNumber('+351 912 345 678'), '912345678');
  assert.equal(normalizePhoneNumber('00351-912345678'), '912345678');
  assert.equal(normalizePhoneNumber('351912345678'), '912345678');
  assert.equal(normalizePhoneNumber('999999999'), null);
  assert.equal(normalizePhoneNumber(null), null);
});

/**
 * Unit test: validateAddress domain function.
 * Validates the Dependency Injection logic using different dummy behaviors.
 */
test('validateAddress relies securely on the injected validator', async () => {
  const address = { postalCode: '4460-123', city: 'Senhora da Hora' };

  // Dummy mimicking a successful match
  const successValidator = { isValidMatch: async () => true };
  await assert.doesNotReject(async () => await validateAddress(address, successValidator));

  // Dummy mimicking a mismatch/failure
  const failureValidator = { isValidMatch: async () => false };
  await assert.rejects(
    async () => await validateAddress(address, failureValidator),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.message.includes('mismatch'));
      return true;
    },
  );
});