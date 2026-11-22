import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnusualChange,
  MAX_STOCK_QUANTITY,
  resultingQuantity,
  stockSchema,
} from '../../src/features/stock/stock-rules.js';
import { getStockErrorKey } from '../../src/features/stock/stock-errors.js';
import { validateForm } from '../../src/shared/forms/validators.js';
import { messages } from '../../src/shared/i18n/message.js';

describe('Stock movements (WEB04)', () => {
  it('a physical count replaces the quantity (150 counted as 78 -> 78)', () => {
    assert.equal(resultingQuantity(150, 78, 'set'), 78);
    assert.equal(resultingQuantity(150, 72, 'decrease'), 78);
    assert.equal(resultingQuantity(150, 10, 'increase'), 160);
  });

  it('accepts 0 as a count, but not as a movement; refuses values above the maximum', () => {
    const errors = (operation, amount) =>
      validateForm({ amount }, stockSchema(operation));
    assert.deepEqual(errors('set', '0'), {});
    assert.ok(errors('increase', '0').amount);
    assert.ok(errors('set', '-1').amount);
    assert.ok(errors('set', '1.5').amount);
    assert.ok(errors('set', String(MAX_STOCK_QUANTITY + 1)).amount);
    assert.deepEqual(errors('set', String(MAX_STOCK_QUANTITY)), {});
  });

  it('asks for confirmation only for unusual changes (1000 units or more)', () => {
    assert.equal(isUnusualChange(150, 78, 'set'), false);
    assert.equal(isUnusualChange(150, 999, 'increase'), false);
    assert.equal(isUnusualChange(150, 1000, 'increase'), true);
    assert.equal(isUnusualChange(150, 15000, 'set'), true); // an extra zero typed
    assert.equal(isUnusualChange(5000, 0, 'set'), true);
  });

  it('maps the API refusals to specific texts in both languages', () => {
    const apiError = (code) => ({
      status: 400,
      code,
      fieldErrors: [],
      global: false,
    });
    assert.equal(
      getStockErrorKey('set', apiError('STOCK_ABOVE_MAXIMUM')),
      'stock.errors.aboveMaximum'
    );
    assert.equal(
      getStockErrorKey('set', apiError('STOCK_INVALID_AMOUNT')),
      'stock.errors.invalidCount'
    );
    assert.equal(
      getStockErrorKey('decrease', apiError('STOCK_NEGATIVE')),
      'stock.errors.insufficient'
    );
    for (const language of Object.keys(messages)) {
      const stock = messages[language].stock;
      for (const key of [
        'set',
        'counted',
        'confirmUnusual',
        'confirmUnusualTitle',
      ]) {
        assert.ok(stock[key], `${language}:stock.${key}`);
      }
      assert.ok(
        stock.form.setAmount &&
          stock.errors.aboveMaximum &&
          stock.errors.invalidCount,
        language
      );
    }
  });
});
