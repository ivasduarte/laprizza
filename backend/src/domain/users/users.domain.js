/**
 * Assignable base roles. A user may have several, or none.
 * A user without roles only gets the Guest permissions.
 *
 * @constant
 * @type {Object}
 * @property {string} MANAGER - LaPrizza Manager.
 * @property {string} EMPLOYEE - Internal staff member with operational access.
 * @property {string} CUSTOMER - External client associated with a customerId.
 */
export const Roles = Object.freeze({
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  CUSTOMER: 'CUSTOMER',
});

const KNOWN_ROLES = new Set(Object.values(Roles));

/**
 * AA03: initial roles of a NEW internal account (local or external). Customer is always
 * assigned by the back end; the other requested roles are kept (their assignment is authorized
 * separately, AA05). Assigning Customer never changes the account status.
 *
 * @param {string[]} [requestedRoles=[]]
 * @returns {string[]} Customer first, then the other known roles, without duplicates.
 */
export function withInitialCustomerRole(requestedRoles = []) {
  return activeRoles([Roles.CUSTOMER, ...(Array.isArray(requestedRoles) ? requestedRoles : [])]);
}

/**
 * AA03: the active internal roles of an account, as stored in the back end. Anything that is
 * not a known base role (legacy values, typos, roles from another system) is ignored.
 *
 * @param {unknown} roles
 * @returns {string[]}
 */
export function activeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return [...new Set(roles.filter((role) => KNOWN_ROLES.has(role)))];
}

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

/**
 * States of a user account.
 * - INACTIVE: create but not activated yet
 * - ACTIVE: may authenticate
 * - DISABLED: blocked by a Manager
 */
export const AccountStatus = Object.freeze({
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

/**
 * Maps the 'isActive' flag to an account status.
 * 
 * @param {boolean} isActive 
 * @returns {string}
 */
export function statusFromIsActive(isActive) {
  return isActive ? AccountStatus.ACTIVE : AccountStatus.DISABLED;
}

/**
 * Normalizes the login identifier.
 * 
 * @param {string} email 
 * @returns {string} The normalized email, or '' for a non-string input.
 */
export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}