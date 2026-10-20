import Products from './products.model.js';
import mongoose from 'mongoose';
import { escapeRegex } from './utils/escape-regex.js';

export async function create(productData) {
  return Products.create(productData);
}

export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;

  return Products.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function listProducts(query = {}) {
  const filter = {};
  const term = query.search?.trim();

  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: regex }, { description: regex }];
  }

  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  return Products.find(filter)
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;

  return Products.findById(id)
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function findByName(name) {
  return await Products.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
}

/**
 * Adds the size configuration of a pizza component for a pizza size.
 * The Component Size Configuration is a Value Object of the Product, so it is stored inside the product.
 * 
 * @param {string} productId - The id of the product (pizza component). 
 * @param {Object} configuration - The configuration to add. 
 * @returns {Promise<Object|null} The updated product, or null if the product does not exist or already has a configuration for the pizza size.
 */
export async function addSizeConfiguration(productId, configuration) {
  if (!mongoose.isValidObjectId(productId)) return null;

  return Products.findOneAndUpdate(
    { _id: productId, 'sizeConfigurations.pizzaSizeId': { $ne: configuration.pizzaSizeId } },
    { $push: { sizeConfigurations: configuration } },
    { returnDocument: 'after', runValidators: true },
  );
}

/**
 * Replaces the values of the size configuration of a product for a pizza size.
 * 
 * @param {string} productId - The id of the product (pizza component).
 * @param {string} pizzaSizeId - The id of the pizza size that identifies the configuration.
 * @param {Object} values - The new values of the configuration. 
 * @returns {Promise<Object|null>} The updated product, or null if the product has no configuration for the pizza size.
 */
export async function updateSizeConfiguration(productId, pizzaSizeId, { price, stockUnitsConsumed }) {
  if (!mongoose.isValidObjectId(productId)) return null;

  return Products.findOneAndUpdate(
    { _id: productId, 'sizeConfigurations.pizzaSizeId': pizzaSizeId },
    {
      $set: {
        'sizeConfigurations.$.price': price,
        'sizeConfigurations.$.stockUnitsConsumed': stockUnitsConsumed,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
}

/**
 * Removes the size configuration of a product for a pizza size.
 * As a Value Object, the configuration is not kept after its removal.
 * 
 * @param {string} productId - The id of the product (pizza component).
 * @param {string} pizzaSizeId - The id of the pizza size that identifies the configuration.
 * @returns {Promise<Object|null>} The updated product, or null if the product has no configuration for the pizza size.
 */
export async function removeSizeConfiguration(productId, pizzaSizeId) {
  if (!mongoose.isValidObjectId(productId)) return null;

  return Products.findOneAndUpdate(
    { _id: productId, 'sizeConfigurations.pizzaSizeId': pizzaSizeId },
    { $pull: { sizeConfigurations: { pizzaSizeId } } },
    { returnDocument: 'after' },
  );
}

/**
 * Checks whether a pizza size is used by the size configuration of any product.
 * Used to block the removal of a pizza size that is still in use.
 *
 * @param {string} pizzaSizeId - The id of the pizza size.
 * @returns {Promise<boolean>} True if at least one product has a configuration for the pizza size.
 */
export async function existsWithSizeConfigurationForPizzaSize(pizzaSizeId) {
  return (await Products.exists({ 'sizeConfigurations.pizzaSizeId': pizzaSizeId })) !== null;
}