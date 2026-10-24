import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import * as defaultUserRepo from '../../infrastructure/users/users.repository.js';

import { validatePasswordStrength, Roles } from '../../domain/users/users.domain.js';
import { AppError } from '../app-error.js';
import { toUserDto } from '../users/users.service.js';

/**
 * Authenticates a user and generates a JSON Web Token (JWT).
 * Normalizes the identifier and verifies the password using Argon2.
 * Includes a timing-attack mitigation mechanism: performs a dummy hash if the user is not found or inactive.
 *
 * @param {Object} credentials - The user's login credentials.
 * @param {string} credentials.identifier - The user's email or username.
 * @param {string} credentials.password - The user's plain text password.
 * @param {Object} [usersRepository=defaultUserRepo] - The injected repository for database operations.
 * @returns {Promise<string>} A promise that resolves to the signed JWT string.
 * @throws {AppError} Throws a 401 error if credentials are invalid or the account is inactive.
 */
export async function login({ identifier, password }, usersRepository = defaultUserRepo) {
  const normalizedId = identifier.trim().toLowerCase();
  const user = await usersRepository.findByEmailOrUsername(normalizedId);

  if (!user || user.isActive === false) {
    await argon2.hash(password);
    throw new AppError('Invalid Credentials.', 401);
  }

  const isValid = await argon2.verify(user.password, password);
  if (!isValid) throw new AppError('Invalid Credentials.', 401);

  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}

/**
 * Registers a new user in the system.
 * Validates role constraints, enforces password strength rules, hashes the password,
 * and handles database duplicate key errors (11000).
 *
 * @param {Object} userData - The data payload for creating the user.
 * @param {string} [userData.username] - The user's unique username.
 * @param {string} [userData.email] - The user's unique email address.
 * @param {string} userData.password - The user's plain text password.
 * @param {string} userData.role - The role assigned to the user (e.g., 'MANAGER', 'EMPLOYEE', 'CUSTOMER').
 * @param {string} [userData.customerId] - The associated customer ID (only applicable if the role is 'CUSTOMER').
 * @param {Object} [usersRepository=defaultUserRepo] - The injected repository for database operations.
 * @returns {Promise<Object>} A promise that resolves to the newly created user Data Transfer Object (DTO).
 * @throws {AppError} Throws a 400 error for invalid data/password rules, or 409 for duplicate email/username.
 */
export async function registerUser(
  { username, email, password, role, customerId },
  usersRepository = defaultUserRepo,
) {
  if (customerId && role !== Roles.CUSTOMER) {
    throw new AppError('Only users with the CUSTOMER role can have an associated customerId.', 400);
  }

  try {
    validatePasswordStrength(password);
  } catch (err) {
    throw new AppError(err.message, 400);
  }

  const hashedPassword = await argon2.hash(password);

  try {
    const savedUser = await usersRepository.create({
      username: username?.trim().toLowerCase(),
      email: email?.trim().toLowerCase(),
      password: hashedPassword,
      role,
      customerId,
    });

    return toUserDto(savedUser);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Email or username already in use.', 409);
    throw err;
  }
}
