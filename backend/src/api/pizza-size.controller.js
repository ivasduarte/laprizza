import * as sizeService from '../application/pizza-size.service.js';

/**
 * Handles the request to list pizza sizes, optionally filtered by `req.query.search`.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [sizeRepository] - The injected repository for pizza size-related database operations.
 */
export const list = async (req, res, next, sizeRepository) => {
  try {
    const sizes = await sizeService.listSizes(req.query, sizeRepository);
    res.status(200).json(sizes);
  } catch (err) {
    next(err);
  }
};


/**
 * Handles the request to create a new pizza size.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer details in `req.body`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [sizeRepository] - The injected repository for pizza size-related database operations.
 */
export const create = async (req, res, next, sizeRepository) => {
  try {
    const newSize = await sizeService.createSize(req.body, sizeRepository);
    res.status(201).json(newSize);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to retrieve a specific pizza size by their ID.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer ID in `req.params.id`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [sizeRepository] - The injected repository for pizza size-related database operations.
 */
export const getById = async (req, res, next, sizeRepository) => {
  try {
    const size = await sizeService.getSizeById(req.params.id, sizeRepository);
    res.status(200).json(size);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to update an existing pizza size.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer details in `req.body`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [sizeRepository] - The injected repository for pizza size-related database operations.
 */
export const update = async (req, res, next, sizeRepository, productsRepository) => {
  try {
    const updatedSize = await sizeService.updateSize(
      req.params.id,
      req.body,
      sizeRepository,
      productsRepository,
    );
    res.status(200).json(updatedSize);
  } catch (err) {
    next(err);
  }
};