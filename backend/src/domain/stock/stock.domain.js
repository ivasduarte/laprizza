import { DomainError } from '../domain-error.js';

export function validateStockQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError('Invalid Stock Quantity: Must be a non-negative integer.');
  }
  return quantity;
}

export function validateStockChange(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new DomainError('Invalid Stock Change: Amount must be a positive integer.');
  }
  return amount;
}

/** WEB04: how a stock movement is expressed. `set` records a physical count (absolute value). */
export const StockOperation = Object.freeze({
  INCREASE: 'increase',
  DECREASE: 'decrease',
  SET: 'set',
});

/**
 * WEB04: upper bound of the quantity of one product, in stock units. Anything above it is a
 * typing error, never a real stock level, and is refused by the back end. Smaller but unusual
 * values are confirmed by the user in the SPA.
 */
export const MAX_STOCK_QUANTITY = 100_000;

/**
 * Quantity after a stock movement.
 *
 * @param {number} current - Current quantity.
 * @param {number} amount - Units moved (increase/decrease, > 0) or counted quantity (set, >= 0).
 * @param {'increase'|'decrease'|'set'} operation
 * @returns {number}
 * @throws {DomainError} code STOCK_INVALID_OPERATION, STOCK_INVALID_AMOUNT, STOCK_NEGATIVE or
 *   STOCK_ABOVE_MAXIMUM.
 */
export function nextStockQuantity(current, amount, operation) {
  const fail = (code, message) => {
    const error = new DomainError(message);
    error.code = code;
    throw error;
  };

  let next;
  if (operation === StockOperation.SET) {
    if (!Number.isInteger(amount) || amount < 0) {
      fail('STOCK_INVALID_AMOUNT', 'Invalid Stock Count: Quantity must be a non-negative integer.');
    }
    next = amount;
  } else if (operation === StockOperation.INCREASE || operation === StockOperation.DECREASE) {
    if (!Number.isInteger(amount) || amount <= 0) {
      fail('STOCK_INVALID_AMOUNT', 'Invalid Stock Change: Amount must be a positive integer.');
    }
    next = operation === StockOperation.INCREASE ? current + amount : current - amount;
  } else {
    fail('STOCK_INVALID_OPERATION', 'Invalid operation. Use increase, decrease or set.');
  }

  if (next < 0) fail('STOCK_NEGATIVE', 'Stock reduction cannot result in a negative quantity');
  if (next > MAX_STOCK_QUANTITY) {
    fail('STOCK_ABOVE_MAXIMUM', `Stock cannot exceed ${MAX_STOCK_QUANTITY} units.`);
  }
  return next;
}
