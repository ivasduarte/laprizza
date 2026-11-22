/**
 * Client-side validation. Rules return the same `{ type, limit? }` descriptors the API returns
 * in `error.details`, so client and server errors share one translation path.
 *
 * @typedef {{ type: string, limit?: number }} Violation
 * @typedef {(value: unknown, values: Record<string, unknown>) => Violation | null} Rule
 */

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

const length = (value) => String(value).trim().length;

/** @returns {Rule} */
export const required = () => (value) =>
  isBlank(value) ? { type: 'any.required' } : null;

/** @returns {Rule} */
export const minLength = (limit) => (value) =>
  !isBlank(value) && length(value) < limit
    ? { type: 'string.min', limit }
    : null;

/** @returns {Rule} */
export const maxLength = (limit) => (value) =>
  !isBlank(value) && length(value) > limit
    ? { type: 'string.max', limit }
    : null;

/** @returns {Rule} */
export const email = () => (value) =>
  !isBlank(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
    ? { type: 'string.email' }
    : null;

/** @returns {Rule} */
export const pattern =
  (regex, type = 'string.pattern.base') =>
  (value) =>
    !isBlank(value) && !regex.test(String(value)) ? { type } : null;

/** @returns {Rule} */
export const integer = () => (value) =>
  !isBlank(value) && !Number.isInteger(Number(value))
    ? { type: 'number.integer' }
    : null;

/** @returns {Rule} */
export const minValue = (limit) => (value) =>
  !isBlank(value) && Number(value) < limit
    ? { type: 'number.min', limit }
    : null;

/** @returns {Rule} */
export const maxValue = (limit) => (value) =>
  !isBlank(value) && Number(value) > limit
    ? { type: 'number.max', limit }
    : null;

/**
 * Portuguese phone number, same rule as the back end (customers.domain.js): 9 digits starting
 * with 2[1-9] or 91/92/93/96, optional +351 / 00351. @returns {Rule}
 */
export const portuguesePhone = () => (value) => {
  if (isBlank(value)) return null;
  let digits = String(value).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+351')) digits = digits.slice(4);
  else if (digits.startsWith('00351')) digits = digits.slice(5);
  else if (digits.startsWith('351') && digits.length === 12)
    digits = digits.slice(3);
  return /^(2[1-9]|9[1236])\d{7}$/.test(digits)
    ? null
    : { type: 'customer.phone' };
};

/**
 * WEB04: a person's name: letters (any alphabet, with accents) in words separated by one space,
 * apostrophe or hyphen; no digits or symbols, never at the start or the end. Same rule as the
 * back end (customers.domain.js PERSON_NAME_PATTERN).
 */
export const PERSON_NAME_PATTERN =
  /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;

/** City and district names: letters, with spaces, apostrophes, hyphens or dots between words. */
export const PLACE_NAME_PATTERN =
  /^\p{L}[\p{L}\p{M}]*(?:[ '’.-]+\p{L}[\p{L}\p{M}]*)*$/u;

/** @returns {Rule} */
export const personName = () => (value) =>
  isBlank(value) || PERSON_NAME_PATTERN.test(String(value).trim())
    ? null
    : { type: 'person.name' };

/** @returns {Rule} */
export const placeName = () => (value) =>
  isBlank(value) || PLACE_NAME_PATTERN.test(String(value).trim())
    ? null
    : { type: 'place.name' };

/** Value must equal another field (e.g. password confirmation). @returns {Rule} */
export const sameAs =
  (otherField) =>
  (value, values = {}) =>
    value !== values[otherField] ? { type: 'custom.mismatch' } : null;

/** First violation of a value, or null. */
export function validateField(value, rules, values = {}) {
  for (const rule of rules) {
    const violation = rule(value, values);
    if (violation) return violation;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} values
 * @param {Record<string, Rule[]>} schema - field name (same key as the API path) -> rules
 * @returns {Record<string, Violation>} one violation per invalid field; `{}` when valid
 */
export function validateForm(values, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    const violation = validateField(values[field], rules, values);
    if (violation) errors[field] = violation;
  }
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;

/** API field errors -> `{ [field]: violation }` (first error per field). */
export function toFieldMap(fieldErrors = []) {
  const map = {};
  for (const { field, type, limit } of fieldErrors) {
    if (!(field in map))
      map[field] = limit === undefined ? { type } : { type, limit };
  }
  return map;
}

/** Same policy as the back end: 8-64 chars, one uppercase letter, one of ! @ # $ % ^ & * . , - _ ? */
export const passwordRules = () => [
  required(),
  minLength(8),
  maxLength(64),
  pattern(/[A-Z]/, 'password.uppercase'),
  pattern(/[!@#$%^&*.,\-_?]/, 'password.symbol'),
];
