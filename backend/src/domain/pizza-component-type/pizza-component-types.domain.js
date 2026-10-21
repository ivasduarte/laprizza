import { DomainError } from '../domain-error.js';

export const DEFAULT_PIZZA_COMPONENT_TYPES = Object.freeze([
  Object.freeze({ name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 }),
  Object.freeze({ name: 'Base Sauce', assemblyOrder: 2, minQuantity: 0, maxQuantity: 1 }),
  Object.freeze({ name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 }),
  Object.freeze({ name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null }),
]);

export function normalizeName(name) {
  if (typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

export function validateName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError('Invalid Name: The name is required and cannot be blank.');
  }
}

export function validateAssemblyOrder(order) {
  if (!Number.isInteger(order) || order < 1) {
    throw new DomainError('Invalid Assembly Order: Must be an integer greater than or equal to 1.');
  }
}

export function validateMinQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError('Invalid Minimum Quantity: Must be a non-negative integer.');
  }
}

export function normalizeMaxQuantity(quantity) {
  return quantity === undefined ? null : quantity;
}

export function validateMaxQuantity(quantity) {
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
    throw new DomainError(
      'Invalid Maximum Quantity: Must be an integer greater than or equal to 1, or null for unbounded.',
    );
  }
}

export function validateQuantityRange(minQuantity, maxQuantity) {
  if (minQuantity > maxQuantity && maxQuantity !== null) {
    throw new DomainError('Invalid Range: Maximum Quantity cannot be lower than Minimum Quantity.');
  }
}
