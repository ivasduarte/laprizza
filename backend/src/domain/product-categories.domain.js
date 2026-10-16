import { DomainError } from './domain-error.js';

/**
 * Normalizes a product category name before it is validated or stored.
 * This function is used to trim the string, as well as collapse consecutive whitespaces into a single space.
 * Example: "Soft  Drinks" and "Soft Drinks" are considered the same name.
 *
 * @param {string} name - The raw descriptive name received from the client.
 * @returns {string} The normalized name. Non-string values are returned unchanged, so that {@link validateName} can reject them.
 */
export function normalizeName(name) {
  if (typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Validates the name of the Product Category.
 * Business Rule: The name is required and cannot be blank.
 *
 * @param {string} name - The name to validate (already normalized).
 * @returns {void}
 * @throws {Error} Throws standard error if the name fails the validation.
 */
export function validateName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError('Invalid Name: The name is required and cannot be blank.');
  }
}
