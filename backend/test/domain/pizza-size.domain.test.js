import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePizzaSize } from '../../src/domain/pizza-size.domain.js';

test('validatePizzaSize rejects invalid data types and formats', async () => {
  await assert.rejects(async () => await validatePizzaSize(''), /Name cannot be empty/);
  await assert.rejects(async () => await validatePizzaSize('   '), /Name cannot be empty/);
  await assert.rejects(async () => await validatePizzaSize(null), /Name cannot be empty/);
  await assert.rejects(async () => await validatePizzaSize(undefined), /Name cannot be empty/);
  await assert.rejects(async () => await validatePizzaSize(123), /Name cannot be empty/);
  await assert.rejects(async () => await validatePizzaSize({}), /Name cannot be empty/);
});

test('validatePizzaSize accepts valid strings', async () => {
  await assert.doesNotReject(async () => await validatePizzaSize('Small'));
  await assert.doesNotReject(async () => await validatePizzaSize('Extra Large'));
});