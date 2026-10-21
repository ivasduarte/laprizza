import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStockQuantity, validateStockChange } from '../../src/domain/stock/stock.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

test('validateStockQuantity accepts non-negative integers', () => {
  assert.equal(validateStockQuantity(0), 0);
  assert.equal(validateStockQuantity(10), 10);
});

test('validateStockQuantity rejects negatives, decimals and non-numbers', () => {
  const invalidInputs = [-1, 1.5, '10', null, undefined, NaN, {}];
  for (const input of invalidInputs) {
    assert.throws(
      () => validateStockQuantity(input),
      (err) => err instanceof DomainError,
    );
  }
});

test('validateStockChange accepts strictly positive integers', () => {
  assert.equal(validateStockChange(1), 1);
  assert.equal(validateStockChange(50), 50);
});

test('validateStockChange rejects zero, negatives, decimals and non-numbers', () => {
  const invalidInputs = [0, -5, 2.5, '5', null, undefined, NaN];
  for (const input of invalidInputs) {
    assert.throws(
      () => validateStockChange(input),
      (err) => err instanceof DomainError,
    );
  }
});
