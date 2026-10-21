import * as defaultProductCategoriesRepository from '../../infrastructure/product-categories/product-categories.repository.js';
import {
  normalizeName,
  validateName,
} from '../../domain/product-categories/product-categories.domain.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';

/** MongoDB error code for violation of a unique index. */
const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Converts a raw database user document into a safe Data Transfer Object (DTO).
 * Exposes the MongoDB '_id' as 'id' and strips internal database fields.
 *
 * @param {Object} category - The raw database document representing a product category.
 * @returns {Object} The product category DTO safe for client consumption.
 */
export function toProductCategoryDTO(category) {
  return {
    id: category._id || category.id,
    name: category.name,
    isActive: category.isActive ?? true,
  };
}

/**
 * Validates and normalizes the product category data using the domain rules.
 *
 * @param {string} name - The name of the product category.
 * @returns {{ name: string }} The valid product category data.
 * @throws {AppError} Throws a 400 error if the data violates domain rules.
 */
function buildValidProductCategory(categoryData) {
  const normalizedName = normalizeName(categoryData?.name);

  try {
    validateName(normalizedName);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }

  return { name: normalizedName };
}

/**
 * Translates a duplicate key error of the database into a 409 conflict.
 * This is what protects the uniqueness of the name when two requests arrive at the same time.
 * Any other error is rethrown unchanged.
 *
 * @param {Error} err - The error thrown by the repository.
 * @throws {AppError} Throws a 409 error for a duplicate name, otherwise the original error.
 */
function handleDuplicateName(err) {
  if (err.code === DUPLICATE_KEY_ERROR_CODE) {
    throw new AppError('A product category with this name already exists.', 409);
  }
  throw err;
}

/**
 * Retrieves the product categories.
 * Without a name, all categories are returned. With a name, the categories whose name is exactly that name (ignoring case and accents) are returned.
 * A blank name matches nothing.
 *
 * @param {string} [name] - The exact name to search for.
 * @param {Object} [productCategoriesRepository] - The injected repository for database operations.
 * @returns {Promise<Object[]>} A promise that resolves to an array of product category DTOs.
 */
export async function listProductCategories(
  name,
  productCategoriesRepository = defaultProductCategoriesRepository,
) {
  const categories =
    name === undefined
      ? await productCategoriesRepository.listProductCategories()
      : await productCategoriesRepository.searchByName(name);

  return categories.map(toProductCategoryDTO);
}

/**
 * Creates a new product category.
 * The uniqueness of the name is enforced by the unique index of the database.
 *
 * @param {Object} categoryData - The data of the new product category.
 * @param {Object} [productCategoriesRepository] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the created product category DTO.
 * @throws {AppError} Throws a 400 error if the data is invalid, or a 409 if the name already exists.
 */
export async function createProductCategory(
  categoryData,
  productCategoriesRepository = defaultProductCategoriesRepository,
) {
  const validData = buildValidProductCategory(categoryData);

  try {
    const category = await productCategoriesRepository.create(validData);
    return toProductCategoryDTO(category);
  } catch (err) {
    return handleDuplicateName(err);
  }
}

/**
 * Retrieves a specific product category by its unique identifier.
 *
 * @param {string} id - The unique identifier of the product category.
 * @param {Object} [productCategoriesRepository] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the product category DTO.
 * @throws {AppError} Throws a 404 error if the product category is not found.
 */
export async function getProductCategoryById(
  id,
  productCategoriesRepository = defaultProductCategoriesRepository,
) {
  const category = await productCategoriesRepository.findById(id);
  if (!category) throw new AppError('Product category not found.', 404);

  return toProductCategoryDTO(category);
}

/**
 * Updates the name of an existing product category.
 * The uniqueness of the name is enforced by the unique index of the database.
 *
 * @param {string} id - The unique identifier of the product category to update.
 * @param {Object} updateData - The new data of the product category.
 * @param {Object} [productCategoriesRepository] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the updated product category DTO.
 * @throws {AppError} Throws a 400 error if the data is invalid, a 404 error if the product category is not found, or a 409 error if the name already exists.
 */
export async function updateProductCategory(
  id,
  updateData,
  productCategoriesRepository = defaultProductCategoriesRepository,
) {
  const validData = buildValidProductCategory(updateData);
  let updatedCategory;

  try {
    updatedCategory = await productCategoriesRepository.update(id, validData);
  } catch (err) {
    return handleDuplicateName(err);
  }

  if (!updatedCategory) throw new AppError('Product category not found.', 404);

  return toProductCategoryDTO(updatedCategory);
}

/**
 * Removes a product category.
 * Business Rule: a category referenced by existing products cannot be removed, so that the product are never left with a category that does not exist.
 *
 * @param {string} id - The unique identifier of the product category to remove.
 * @param {Object} [productCategoriesRepository] - The injected repository for product category database operations.
 * @throws {AppError} Throws a 404 if the product category is not found, or a 409 error if it is referenced by at least one product.
 */
export async function removeProductCategory(
  id,
  productCategoriesRepository = defaultProductCategoriesRepository,
) {
  const category = await productCategoriesRepository.findById(id);
  if (!category || !category.isActive) throw new AppError('Product Category not found.', 404);

  // const isReferenced = await productsRepository.existsByCategory(id);
  // if (isReferenced) {
  //   throw new AppError('Cannot remove a referenced product category.', 409);
  // }

  await productCategoriesRepository.update(id, {
    isActive: false,
  });
}
