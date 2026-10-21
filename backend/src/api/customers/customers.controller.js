import * as customersService from '../../application/customers/customers.service.js';

/**
 * Handles the request to list customers, optionally filtered by `req.query.search`.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [customersRepository] - The injected repository for customer-related database operations.
 */
export const list = async (req, res, next, customersRepository) => {
  try {
    const customers = await customersService.listCustomers(req.query, customersRepository);
    res.status(200).json(customers);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to create a new customer.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer details in `req.body`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [customersRepository] - The injected repository for customer-related database operations.
 * @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected postal code validator.
 */
export const create = async (req, res, next, customersRepository, postalCodeValidator) => {
  try {
    const newCustomer = await customersService.createCustomer(
      req.body,
      customersRepository,
      postalCodeValidator,
    );
    res.status(201).json(newCustomer);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to retrieve a specific customer by their ID.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer ID in `req.params.id`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [customersRepository] - The injected repository for customer-related database operations.
 */
export const getById = async (req, res, next, customersRepository) => {
  try {
    const customer = await customersService.getCustomerById(req.params.id, customersRepository);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request to update an existing customer.
 *
 * @param {import('express').Request} req - The Express request object, containing the customer ID in `req.params.id` and the update data in `req.body`.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @param {Object} [customersRepository] - The injected repository for customer-related database operations.
 * @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected postal code validator.
 */
export const update = async (req, res, next, customersRepository, postalCodeValidator) => {
  try {
    const updatedCustomer = await customersService.updateCustomer(
      req.params.id,
      req.body,
      customersRepository,
      postalCodeValidator,
    );
    res.status(200).json(updatedCustomer);
  } catch (err) {
    next(err);
  }
};
