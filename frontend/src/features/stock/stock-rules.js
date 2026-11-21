import {
  integer,
  maxValue,
  minValue,
  required,
} from '../../shared/forms/validators.js';

/** Same ceiling as the back end (stock.domain.js MAX_STOCK_QUANTITY). */
export const MAX_STOCK_QUANTITY = 100_000;

/**
 * WEB04: a movement of this many units or more is unusual for a pizzeria and is shown to the
 * manager for confirmation before it is sent (typing an extra zero is the usual cause).
 */
export const UNUSUAL_CHANGE_UNITS = 1_000;

export const StockOperation = Object.freeze({
  INCREASE: 'increase',
  DECREASE: 'decrease',
  SET: 'set',
});

/** Client rules, same as the API: units to move > 0, counted quantity >= 0, both <= maximum. */
export function stockSchema(operation) {
  const min = operation === StockOperation.SET ? 0 : 1;
  return {
    amount: [
      required(),
      integer(),
      minValue(min),
      maxValue(MAX_STOCK_QUANTITY),
    ],
  };
}

/** Quantity after the movement (may be outside 0..max; the API refuses those). */
export function resultingQuantity(current, amount, operation) {
  if (operation === StockOperation.SET) return amount;
  return operation === StockOperation.INCREASE
    ? current + amount
    : current - amount;
}

/**
 * True when the movement changes the stock by UNUSUAL_CHANGE_UNITS or more, so the manager
 * confirms the value (WEB04).
 */
export function isUnusualChange(current, amount, operation) {
  const next = resultingQuantity(current, amount, operation);
  return Math.abs(next - current) >= UNUSUAL_CHANGE_UNITS;
}
