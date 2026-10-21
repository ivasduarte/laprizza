import { DomainError } from '../domain-error.js';

export async function validateAddress(address, postalCodeValidator) {
  const isMatch = await postalCodeValidator.isValidMatch(address.postalCode, address.city);
  if (!isMatch) {
    throw new DomainError('Invalid Address: Postal code and city mismatch.');
  }
}

function toNationalDigits(phoneNumber) {
  if (typeof phoneNumber !== 'string') return null;
  let digits = phoneNumber.replace(/[\s\-().]/g, '');

  if (digits.startsWith('+351')) digits = digits.slice(4);
  else if (digits.startsWith('00351')) digits = digits.slice(5);
  else if (digits.startsWith('351') && digits.length === 12) digits = digits.slice(3);

  return digits;
}

export function validatePhoneNumber(phoneNumber = '') {
  const digits = toNationalDigits(phoneNumber);
  if (digits === null || !/^[29]\d{8}$/.test(digits)) return false;

  const fixedPrefixes = ['21', '22', '23', '24', '25', '26', '27', '28', '29'];
  const mobilePrefixes = ['91', '92', '93', '96'];
  const prefix = digits.slice(0, 2);

  return fixedPrefixes.includes(prefix) || mobilePrefixes.includes(prefix);
}

/**
 * Returns the 9 national digits of a valid Portuguese phone number, or null if it is invalid.
 *
 * @param {string} phoneNumber - Phone number in any accepted format.
 * @returns {string|null} The normalized number or null.
 */
export function normalizePhoneNumber(phoneNumber) {
  return validatePhoneNumber(phoneNumber) ? toNationalDigits(phoneNumber) : null;
}
