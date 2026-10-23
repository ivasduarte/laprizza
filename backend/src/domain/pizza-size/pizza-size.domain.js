import { DomainError } from '../domain-error.js';

/**
 * Exports the name of the pizza size according to business rules.
 *  
 * @param {string} name - The name of the size (ex: 'Small', 'Large').
 * @throws {DomainError} If the name is invalid.
 */
export async function validatePizzaSize(name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new DomainError('Invalid Pizza Size: Name cannot be empty.');
    }
    return name.trim();
}