import { DomainError } from '../domain-error.js';

export function validateAllergenName(name) {
  if (name === undefined || name === null) {
    throw new DomainError('Invalid Allergen: Name is required.');
  }

  if (typeof name !== 'string') {
    throw new DomainError('Invalid Allergen: Name must be a string.');
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    throw new DomainError('Invalid Allergen: Name cannot be empty.');
  }

  return trimmedName;
}

export function createAllergenData(name) {
  const validName = validateAllergenName(name);

  return {
    name: validName,
  };
}
