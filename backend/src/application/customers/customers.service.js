import * as defaultCustomerRepo from '../../infrastructure/customers/customers.repository.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { validateAddress, normalizePhoneNumber } from '../../domain/customers/customers.domain.js';

/**
 * Converts a raw database customer document into a safe Data Transfer Object (DTO).
 * Strips away sensitive information like passwords and internal database fields.
 *
 * @param {Object} customer - The raw database document representing a customer.
 * @returns {Object} The filtered user DTO safe for client consumption.
 */
export function toCustomerDto(customer) {
  return {
    id: customer._id || customer.id,
    name: customer.name,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    address: customer.address,
    dietaryRestrictions: customer.dietaryRestrictions,
    isActive: customer.isActive ?? true,
  };
}

/**
 * Maps a MongoDB duplicate key error (11000) to a 409 AppError naming the conflicting field.
 *
 * @param {Error & { keyPattern?: Object }} err - The duplicate key error.
 * @returns {AppError} The 409 error.
 */
function toConflictError(err) {
  const field = Object.keys(err.keyPattern ?? {})[0];
  if (field === 'phoneNumber') return new AppError('Phone number already in use.', 409);
  if (field === 'email') return new AppError('Email already in use.', 409);
  return new AppError('Email or phone number already in use.', 409);
}

/**
 * Runs the domain address validation and maps a domain violation to a 400 AppError.
 *
 * @param {Object} address - The address to validate.
 * @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected validator.
 * @throws {AppError} 400 if the address violates a domain rule.
 */
async function assertValidAddress(address, postalCodeValidator) {
  try {
    await validateAddress(address, postalCodeValidator);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
}

/**
 * Registers a new customer in the system.
 * Validates the address against external rules, normalizes the phone number,
 * and handles database duplicate key errors (11000) to ensure uniqueness.
 *
 * @param {Object} customerData - The data payload for creating the customer.
 * @param {Object} [customersRepository=defaultCustomerRepo] - The injected repository for database operations.
 * @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected postal code validator.
 * @returns {Promise<Object>} A promise that resolves to the newly created customer Data Transfer Object (DTO).
 * @throws {AppError} Throws a 400 error for invalid address or phone format, or a 409 error for duplicate email/phone number.
 */
export async function createCustomer(
  customerData,
  customersRepository = defaultCustomerRepo,
  postalCodeValidator,
) {
  await assertValidAddress(customerData.address, postalCodeValidator);

  const phoneNumber = normalizePhoneNumber(customerData.phoneNumber);
  if (!phoneNumber) throw new AppError('Invalid phone number format.', 400);

  try {
    const savedCustomer = await customersRepository.create({ ...customerData, phoneNumber });
    return toCustomerDto(savedCustomer);
  } catch (err) {
    if (err.code === 11000) throw toConflictError(err);
    throw err;
  }
}

/**
 * Retrieves a list of all customers in the system.
 * Maps each database document to a safe Data Transfer Object (DTO).
 *
 * @param {Object} [customersRepository = defaultCustomerRepo] - The injected repository for database operations.
 * @returns {Promise<Object[]>} A promise that resolves to an array of customer DTOs.
 */
export async function listCustomers(query = {}, customersRepository = defaultCustomerRepo) {
  const customers = await customersRepository.listCustomers(query);
  return customers.map(toCustomerDto);
}

/**
 * Retrieves a specific customer by their unique identifier.
 *
 * @param {string} id - The unique identifier of the customer.
 * @param {Object} [customersRepository = defaultCustomerRepo] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the customer DTO.
 * @throws {AppError} Throws a 404 error if the customer is not found in the database.
 */
export async function getCustomerById(id, customersRepository = defaultCustomerRepo) {
  const customer = await customersRepository.findById(id);
  if (!customer) throw new AppError('Customer not found.', 404);
  return toCustomerDto(customer);
}

/**
 * Updates an existing customer's information.
 * Conditionally validates the address and normalizes the phone number if they are provided in the update payload.
 * Handles database duplicate key errors (11000) to ensure email and phone number uniqueness.
 *
 * @param {string} id - The unique identifier of the customer to update.
 * @param {Object} updateData - The fields to update for the customer.
 * @param {Object} [customersRepository=defaultCustomerRepo] - The injected repository for database operations.
 * @param {{ isValidMatch: (postalCode: string, city: string) => Promise<boolean> }} postalCodeValidator - The injected postal code validator.
 * @returns {Promise<Object>} A promise that resolves to the updated customer Data Transfer Object (DTO).
 * @throws {AppError} Throws a 404 error if the customer is not found, a 400 error for invalid data format, or a 409 error for duplicate email/phone number.
 */
export async function updateCustomer(
  id,
  updateData,
  customersRepository = defaultCustomerRepo,
  postalCodeValidator,
) {
  const customer = await customersRepository.findById(id);
  if (!customer) throw new AppError('Customer not found.', 404);

  const data = { ...updateData };

  if (data.address) {
    await assertValidAddress(data.address, postalCodeValidator);
  }
  if (data.phoneNumber !== undefined) {
    const phoneNumber = normalizePhoneNumber(data.phoneNumber);
    if (!phoneNumber) throw new AppError('Invalid phone number format.', 400);
    data.phoneNumber = phoneNumber;
  }

  try {
    const updatedCustomer = await customersRepository.update(id, data);
    return toCustomerDto(updatedCustomer);
  } catch (err) {
    if (err.code === 11000) throw toConflictError(err);
    throw err;
  }
}
