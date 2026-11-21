import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStockQuantity,
  validateStockChange,
  nextStockQuantity,
  MAX_STOCK_QUANTITY,
} from '../../src/domain/stock/stock.domain.js';
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

test('WEB04: nextStockQuantity applies increase, decrease and set (physical count)', () => {
  assert.equal(nextStockQuantity(150, 10, 'increase'), 160);
  assert.equal(nextStockQuantity(150, 72, 'decrease'), 78);
  assert.equal(nextStockQuantity(150, 78, 'set'), 78); // counted 78: no 150-78 arithmetic
  assert.equal(nextStockQuantity(150, 0, 'set'), 0);
});

test('WEB04: nextStockQuantity refuses invalid amounts, negatives and astronomical values', () => {
  const code = (fn) => {
    try {
      fn();
    } catch (err) {
      assert.ok(err instanceof DomainError);
      return err.code;
    }
    return null;
  };
  assert.equal(code(() => nextStockQuantity(5, 0, 'increase')), 'STOCK_INVALID_AMOUNT');
  assert.equal(code(() => nextStockQuantity(5, -1, 'set')), 'STOCK_INVALID_AMOUNT');
  assert.equal(code(() => nextStockQuantity(5, 1.5, 'set')), 'STOCK_INVALID_AMOUNT');
  assert.equal(code(() => nextStockQuantity(5, 6, 'decrease')), 'STOCK_NEGATIVE');
  assert.equal(code(() => nextStockQuantity(5, 1, 'reset')), 'STOCK_INVALID_OPERATION');
  assert.equal(
    code(() => nextStockQuantity(0, MAX_STOCK_QUANTITY + 1, 'set')),
    'STOCK_ABOVE_MAXIMUM',
  );
  assert.equal(code(() => nextStockQuantity(MAX_STOCK_QUANTITY, 1, 'increase')), 'STOCK_ABOVE_MAXIMUM');
  assert.equal(nextStockQuantity(0, MAX_STOCK_QUANTITY, 'set'), MAX_STOCK_QUANTITY);
});
