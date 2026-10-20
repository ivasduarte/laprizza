import { DomainError } from './domain-error.js';

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
