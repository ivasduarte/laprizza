import mongoose from 'mongoose';
import ProductCategories, {NAME_COLLATION} from './product-categories.model.js';

/**
 * Creates, and saves, a new Product Category document in the database.
 * 
 * @param {Object} categoryData - The data (name) for the new product category. 
 * @returns {Promise<Object>} A promise that resolves to the newly created product category document.
 */
export async function create(categoryData) {
  return ProductCategories.create(categoryData);  
}

/**
 * Retrieves all product category documents from the database.
 * 
 * @returns {Promise<Object[]>} A promise that resolves to an array of product categories documents.
 */
export async function listProductCategories() {
  return ProductCategories.find({
    isActive: true,
  });
}

/**
 * Finds a product category document by its MongoDB ObjectId.
 * 
 * @param {string} id - The MongoDB ObjectId of the product category.
 * @returns {Promise<Object|null>} A promise that resolves to the product category, or null if not found.
 */
export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return ProductCategories.findById(id);
}

/**
 * Searches product categories by their exact name.
 * Uses the collation of the unique index, so that comparison ignores uppercase/lowercase letters and accents.
 * As a descriptive name is unique, the result has, at most, one category.
 * If no name is given, all product categories are returned.
 * 
 * @param {string} name - The exact name to search for.
 * @returns {Promise<Object[]} A promise that resolves to an array of matching product category documents.
 */
export async function searchByName(name) {
  const term = typeof name === 'string' ? name.trim() : '';

  if (!term) return [];

  return ProductCategories.find({name: term}).collation(NAME_COLLATION);
}

/**
 * Updates an existing product category document by its MongoDB ObjectId.
 * Uses the { returnDocument: 'after' } option to ensure the returned document reflects the newly updated state, and runs the schema validators on the update.
 * 
 * @param {string} id - The MongoDB ObjectId of the product category to update. 
 * @param {Object} updateData - An Object containing the fields to update. 
 * @returns {Promise<Object|null>} A promise that resolves to the updated product category document, or null if not found.
 */
export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;

  return ProductCategories.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });
}