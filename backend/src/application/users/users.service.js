import * as defaultUsersRepository from '../../infrastructure/users/users.repository.js';
import { passwordHasher } from '../../infrastructure/security/password-hasher.js';
import { Roles, AccountStatus, statusFromIsActive } from '../../domain/users/users.domain.js';
import { assertPasswordPolicy } from '../auth/password-policy.js';
import { AppError } from '../app-error.js';

/**
 * Converts a user document into a safe DTO (no password hash or internal fields).
 *
 * @param {Object} user - The raw database document representing a user.
 * @returns {Object} The filtered user DTO safe for client consumption.
 */
export function toUserDto(user) {
  const status = user.status ?? AccountStatus.ACTIVE;
  return {
    id: user._id || user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status,
    isActive: status === AccountStatus.ACTIVE,
    customerId: user.customerId || null,
  };
}

/**
 * Retrieves a list of all users in the system.
 * Maps each database document to a safe Data Transfer Object (DTO).
 *
 * @param {Object} [usersRepository=defaultUsersRepository] - The injected repository for database operations.
 * @returns {Promise<Object[]>} A promise that resolves to an array of user DTOs.
 */
export async function listUsers(usersRepository = defaultUsersRepository) {
  const users = await usersRepository.listUsers();
  return users.map(toUserDto);
}

/**
 * Retrieves a specific user by their unique identifier.
 *
 * @param {string} id - The unique identifier of the user.
 * @param {Object} [usersRepository=defaultUsersRepository] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the user DTO.
 * @throws {AppError} Throws a 404 error if the user is not found in the database.
 */
export async function getUserById(id, usersRepository = defaultUsersRepository) {
  const user = await usersRepository.findById(id);
  if (!user) throw new AppError('User not found.', 404);
  return toUserDto(user);
}

/**
 * Updates an existing user's information (role, status, or password).
 * Changing the password or disabling the account increments tokenVersion,
 * which immediately invalidates the user's sessions.
 * Enforces business rules: clears `customerId` if the new role is not CUSTOMER,
 * and validates/hashes new passwords before persistence.
 *
 * @param {string} id - The unique identifier of the user to update.
 * @param {Object} updateData - The fields to update.
 * @param {string} [updateData.role] - The new role to assign to the user.
 * @param {boolean} [updateData.isActive] - The new active status of the user.
 * @param {string} [updateData.password] - The new plain text password (will be hashed).
 * @param {Object} [usersRepository=defaultUsersRepository] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the updated user DTO.
 * @throws {AppError} Throws a 404 error if the user is not found, or a 400 error if password validation fails.
 */
export async function updateUser(id, updateData, usersRepository = defaultUsersRepository) {
  const user = await usersRepository.findById(id);
  if (!user) throw new AppError('User not found.', 404);

  const dataToSave = {};
  let revokeSessions = false;

  if (updateData.role) {
    dataToSave.role = updateData.role;
    if (updateData.role !== Roles.CUSTOMER) dataToSave.customerId = null;
  }

  if (updateData.isActive !== undefined) {
    dataToSave.status = statusFromIsActive(updateData.isActive);
    revokeSessions ||= dataToSave.status !== AccountStatus.ACTIVE;
  }

  if (updateData.password) {
    assertPasswordPolicy(updateData.password);
    dataToSave.passwordHash = await passwordHasher.hash(updateData.password);
    dataToSave.failedLoginCount = 0;
    dataToSave.lockedUntil = null;
    revokeSessions = true;
  }

  if (revokeSessions) dataToSave.tokenVersion = (user.tokenVersion ?? 0) + 1;

  const updatedUser = await usersRepository.update(id, dataToSave);
  return toUserDto(updatedUser);
}
