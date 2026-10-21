import * as productCategoriesService from '../../application/product-categories/product-categories.service.js';

/**
 * Handles the request to list or search product categories.
 * If the optional query parameter 'name' is given, searches by the exact name;
 * the decision of what to do with an empty name belongs to the service.
 *
 * @param {import('express').Request} req - The Express request object, optionally containing 'name' in 'req.query'.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} productCategoriesRepository - The injected repository for product category database operations.
 * @returns {Promise<void>}
 */
export const list = async (req, res, next, productCategoriesRepository) => {
  try {
    const categories = await productCategoriesService.listProductCategories(
      req.query.name,
      productCategoriesRepository,
    );
    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to create a new product category.
 *
 * @param {import('express').Request} req - The Express request object, containing the category details in 'req.body'.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} productCategoriesRepository - The injected repository for product category database operations.
 * @returns {Promise<void>}
 */
export const create = async (req, res, next, productCategoriesRepository) => {
  try {
    const newCategory = await productCategoriesService.createProductCategory(
      req.body,
      productCategoriesRepository,
    );
    res.status(201).json(newCategory);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to retrieve a specific product category by its ID.
 *
 * @param {import('express').Request} req - The Express request object, containing the category ID in 'req.params.id'.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} productCategoriesRepository - The injected repository for product category database operations.
 * @returns {Promise<void>}
 */
export const getById = async (req, res, next, productCategoriesRepository) => {
  try {
    const category = await productCategoriesService.getProductCategoryById(
      req.params.id,
      productCategoriesRepository,
    );
    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to update an existing product category.
 *
 * @param {import('express').Request} req - The Express request object, containing the category ID in 'req.params.id' and the new data in 'req.body'.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} productCategoriesRepository - The injected repository for product category database operations.
 * @returns {Promise<void>}
 */
export const update = async (req, res, next, productCategoriesRepository) => {
  try {
    const updatedCategory = await productCategoriesService.updateProductCategory(
      req.params.id,
      req.body,
      productCategoriesRepository,
    );
    res.status(200).json(updatedCategory);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to remove a product category.
 * The service rejects the removal if the category is referenced by any product.
 *
 * @param {import('express').Request} req - The Express request object, containing the category ID in `req.params.id`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} productCategoriesRepository - The injected repository for product category database operations.
 * @param {Object} productsRepository - The injected repository for product database operations, used to check whether the category is referenced by products.
 * @returns {Promise<void>}
 */
export const remove = async (req, res, next, productCategoriesRepository, productsRepository) => {
  try {
    await productCategoriesService.removeProductCategory(
      req.params.id,
      productCategoriesRepository,
      productsRepository,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
