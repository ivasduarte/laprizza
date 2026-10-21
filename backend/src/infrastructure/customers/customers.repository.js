import Customers from './customers.model.js';
import { escapeRegex } from '../utils/escape-regex.js';

/**
 * Creates and saves a new customer document in the database.
 *
 * @param {Object} customerData  - The data for the new customer.
 * @returns {Promise<Object>} A promise that resolves to the newly created customer document.
 */
export async function create(customerData) {
  return Customers.create(customerData);
}

/**
 * Retrieves all customer documents from the database.
 *
 * @returns {Promise<Object>} A promise that resolves to an array of customer documents.
 */
export async function listCustomers(query = {}) {
  const filter = {};
  const term = query.search?.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phoneNumber: regex }];
  }
  return Customers.find(filter);
}

/**
 * Finds a customer document by its MongoDB ObjectId.
 *
 * @param {string} id - The MongoDB ObjectId of the customer.
 * @returns  {Promise<Object|null>} A promise that resolves to the customer document or null if not found.
 */
export async function findById(id) {
  return Customers.findById(id);
}

/**
 * Updates an existing customer document by its MongoDB ObjectId.
 * Uses the { returnDocument: 'after' } option to ensure the returned document reflects the newly updated state, rather than the state before the update.
 *
 * @param {string} id - The MongoDB ObjectId of the customer to update.
 * @param {Object} updateData - An object containing the fields to update.
 * @returns {Promise<Object|null>} A promise that resolves to the updated customer document or null if not found.
 */
export async function update(id, updateData) {
  return Customers.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
}
