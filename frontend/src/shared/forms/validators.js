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
