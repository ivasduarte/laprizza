/** API error codes that have their own translated text (auth.errors.<CODE>). */
export const KNOWN_AUTH_ERRORS = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_INACTIVE',
  'ACCOUNT_DISABLED',
  'TOO_MANY_ATTEMPTS',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'PASSWORD_POLICY_VIOLATION',
  'CURRENT_PASSWORD_INCORRECT',
  'RESET_TOKEN_INVALID',
  'SESSION_REVOKED',
  'REFRESH_INVALID',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
];

/**
 * Translated text for an error from the API (translated by `code`, never by message).
 *
 * @param {(key: string, options?: object) => string} t - i18next translate function.
 * @param {{status?: number, code?: string | null, retryAfterSeconds?: number | null}} error
 */
export function authErrorText(t, error) {
  let code = error?.code;
  if (!code) code = error?.status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR';
  if (!KNOWN_AUTH_ERRORS.includes(code)) code = 'UNKNOWN_ERROR';

  let text = t(`auth.errors.${code}`);
  if (error?.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    text += ` ${t('auth.retryIn', { minutes })}`;
  }
  return text;
}
