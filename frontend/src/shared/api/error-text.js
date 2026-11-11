import { KNOWN_AUTH_ERRORS } from '../auth/auth-error.js';

/** Codes that have a more specific text than their generic `kind`. */
const GENERIC_CODES = ['NETWORK_ERROR', 'UNKNOWN_ERROR', 'VALIDATION_FAILED'];

/**
 * User-facing text of a normalized error. Translated by `code`/`kind`, never by the server message,
 * so stack traces and internal details can not reach the screen.
 *
 * @param {(key: string, options?: object) => string} t
 * @param {import('./error-normalizer.js').NormalizedError} error
 */
export function errorMessage(t, error) {
  const specific =
    error.code &&
    KNOWN_AUTH_ERRORS.includes(error.code) &&
    !GENERIC_CODES.includes(error.code);
  let text = t(
    specific ? `auth.errors.${error.code}` : `feedback.errors.${error.kind}`
  );

  if (error.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    text += ` ${t('auth.retryIn', { minutes })}`;
  }
  if (error.outcomeUnknown) text += ` ${t('feedback.outcomeUnknown')}`;
  return text;
}

/**
 * Text for one field violation: `feedback.validation.<type with dots as underscores>`.
 * Unknown types fall back to a generic text; legacy raw diagnostics are shown as they are.
 *
 * @param {(key: string, options?: object) => string} t
 * @param {import('./error-normalizer.js').FieldError | import('../forms/validators.js').Violation} violation
 */
export function fieldMessage(t, violation) {
  if (violation.raw) return violation.raw;
  const key = `feedback.validation.${violation.type.replaceAll('.', '_')}`;
  return t(key, {
    limit: violation.limit,
    defaultValue: t('feedback.validation.invalid'),
  });
}
