/** Provider names accepted by the back end (lower-case letters only). */
const PROVIDER_PATTERN = /^[a-z]{2,20}$/;

/**
 * Codes the back end may put in /auth/callback?status=error&code=... Each one has a translated
 * text in auth.external.errors.<CODE>. Anything else is shown as AUTH_FAILED.
 */
export const CALLBACK_ERROR_CODES = Object.freeze([
  'ACCESS_DENIED',
  'AUTH_FAILED',
  'EMAIL_MISSING',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_LINK_REQUIRED',
  'ACCOUNT_PENDING_ACTIVATION',
  'ACCOUNT_INACTIVE',
  'ACCOUNT_DISABLED',
  'NO_ACTIVE_ROLE',
  'ROLES_UNAVAILABLE',
  'INVITATION_INVALID',
  'INVITATION_MISMATCH',
]);

/**
 * URL that starts the external login. It is a browser navigation (not an XHR call): the
 * back end redirects to the identity provider.
 *
 * @param {string} apiBaseUrl - Base URL including the version prefix.
 * @param {string} provider
 * @returns {string}
 * @throws {Error} If the provider name is malformed.
 */
export function externalLoginUrl(apiBaseUrl, provider) {
  if (typeof provider !== 'string' || !PROVIDER_PATTERN.test(provider)) {
    throw new Error('Invalid provider.');
  }
  return `${apiBaseUrl.replace(/\/+$/, '')}/auth/external/${provider}/login`;
}

/**
 * Reads the outcome the back end appended to /auth/callback. Never trusts free text:
 * an unknown status or code becomes a generic failure.
 *
 * @param {URLSearchParams} params
 * @returns {{status: 'success'|'activated'|'error', code: string|null}}
 *   `activated` (AA07): the account was activated at the provider; no session was opened.
 */
export function parseCallbackParams(params) {
  if (params.get('status') === 'success') return { status: 'success', code: null };
  if (params.get('status') === 'activated') return { status: 'activated', code: null };
  const code = params.get('code');
  return { status: 'error', code: CALLBACK_ERROR_CODES.includes(code) ? code : 'AUTH_FAILED' };
}
