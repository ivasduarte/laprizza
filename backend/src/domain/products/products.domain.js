import { DomainError } from '../domain-error.js';

export function validateProductName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError('Invalid Product: Name is required and cannot be empty.');
  }
  return name.trim();
}

export function validateProductDescription(description) {
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new DomainError('Invalid Product: Description is required and cannot be empty.');
  }
  return description.trim();
}
