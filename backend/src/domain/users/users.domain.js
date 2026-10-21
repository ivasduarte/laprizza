/**
 * Enum-like object representing the available user roles in the system.
 *
 * @constant
 * @type {Object}
 * @property {string} MANAGER - System administrator with full access, including user management.
 * @property {string} EMPLOYEE - Internal staff member with operational access.
 * @property {string} CUSTOMER - External client associated with a customerId.
 */
export const Roles = {
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  CUSTOMER: 'CUSTOMER',
};

/**
 * Validates a plain text password against strict security requirements (NIST guidelines).
 * Business rule: The password must be between 8 and 64 characters long, contain at least
 * one uppercase letter, and at least one special character.
 *
 * @param {string} password - The plain text password to validate.
 * @returns {void}
 * @throws {Error} Throws a standard Error if the password fails the validation regex.
 */
export function validatePasswordStrength(password) {
  // NIST Rule: from 8 to 64 chars, at least 1 uppercase and special char
  const regex = /^(?=.*[A-Z])(?=.*[!@#$%^&*.,\-_?]).{8,64}$/;

  if (!regex.test(password))
    throw new Error('Invalid Password: The password does not meet the requirements.');
}