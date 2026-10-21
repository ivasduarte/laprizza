import PizzaSize from './pizza-size.model.js';
import { escapeRegex } from '../utils/escape-regex.js';

/**
 * Creates and saves a new customer document in the database.
 * 
 * @param {Object} sizeData - The data for the new customer.
 * @returns  {Promise<Object>} A promise that resolves to the newly created customer document.
 */
export async function create(sizeData) {
  return PizzaSize.create(sizeData);
}

/**
 * Retrieves all pizza sizes documents from the database.
 * 
 * @returns  {Promise<Object>} A promise that resolves to an array of customer documents.
 */
export async function listPizzaSizes(query = {}) {
  const filter = {};
  const term = query.search?.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: regex }]
  }
  return PizzaSize.find(filter);
}

/**
 * Find a pizza size document by its MongoDB ObjectId.
 * 
 * @param {string} id - The MongoDB ObjectId of the customer. 
 * @returns  {Promise<Object|null>} A promise that resolves to the customer document or null if not found. 
 */
export async function findById(id){
  return PizzaSize.findById(id);
}

/**
 * Updates an existing pizza size document by its MongoDB ObjectId.
 * Uses the { returnDocument: 'after' } option to ensure the returned document reflects the newly updated state, rather than the state before the update.
 * 
 * @param {string} id - The MongoDB ObjectId of the pizza size to update.
 * @param {Object} updateData - An object containing the fields to update.
 * @returns {Promise<Object|null>} A promise that resolves to the updated customer document or null if not found.
 */
export async function update(id, updateData) {
  return PizzaSize.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
}