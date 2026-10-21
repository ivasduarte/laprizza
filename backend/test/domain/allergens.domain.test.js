import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAllergenName, createAllergenData } from '../../src/domain/allergen/allergen.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

test('validateAllergenName accepts valid strings and removes spaces', () => {
  assert.equal(validateAllergenName('Glúten'), 'Glúten');
  assert.equal(validateAllergenName('  Lactose  '), 'Lactose');
});

test('validateAllergenName rejects invalid values, nulls or empty strings', () => {
  const invalidInputs = [
    null,
    undefined,
    '',
    '   ',
    123,
    {},
    []
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => validateAllergenName(input),
      (err) => err instanceof DomainError
    );
  }
});

test('createAllergenData returns the structured object with the validated name', () => {
  const data = createAllergenData(' Amendoim ');
  assert.deepEqual(data, { name: 'Amendoim' });
});