/**
 * AA07: account activation with the invitation link sent by AA06
 * (`/activate#token=...`). Pure functions, so the page stays thin and testable.
 */

/** Invitation tokens are 256 random bits in base64url (43 characters). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Activation methods returned by POST /auth/activation/inspect. */
export const ActivationMethod = Object.freeze({
  LOCAL: 'local',
  EXTERNAL: 'external',
});

/**
 * Reads the token from the link fragment. The fragment is never sent to a server nor kept in
 * the Referer; the page removes it from the address bar as soon as it is read.
 *
 * @param {string} hash - `location.hash`, e.g. `#token=abc`.
 * @returns {string|null} The token, or null when it is missing or malformed.
 */
export function readActivationToken(hash) {
  const token = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get(
    'token'
  );
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

/**
 * What the page shows after the link was checked. Unknown answers are treated as an invalid
 * link: the page never offers a step the back end did not ask for.
 *
 * @param {{method?: string, provider?: string, email?: string}} inspection
 * @returns {{step: 'local'|'external'|'invalid', provider?: string, email?: string}}
 */
export function activationStep(inspection) {
  const email = typeof inspection?.email === 'string' ? inspection.email : '';
  if (inspection?.method === ActivationMethod.LOCAL)
    return { step: 'local', email };
  if (
    inspection?.method === ActivationMethod.EXTERNAL &&
    typeof inspection.provider === 'string' &&
    /^[a-z]{2,20}$/.test(inspection.provider)
  ) {
    return { step: 'external', provider: inspection.provider, email };
  }
  return { step: 'invalid' };
}

/**
 * Display name of a provider when the back end only gives its id ("google" -> "Google").
 *
 * @param {string} provider
 * @returns {string}
 */
export function providerLabel(provider) {
  if (typeof provider !== 'string' || !provider) return '';
  return provider[0].toUpperCase() + provider.slice(1);
}

/**
 * Form that starts the external activation: a top-level POST (not an XHR call), so the
 * back end can set the OIDC transaction cookie and redirect to the provider, and the token
 * goes in the body, never in a URL.
 *
 * @param {string} apiBaseUrl - Base URL including the version prefix.
 * @param {string} token
 * @returns {{action: string, method: 'post', fields: {token: string}}}
 * @throws {Error} If the token is malformed.
 */
export function externalActivationForm(apiBaseUrl, token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid activation token.');
  }
  return {
    action: `${String(apiBaseUrl).replace(/\/+$/, '')}/auth/external/activate`,
    method: 'post',
    fields: { token },
  };
}

/**
 * Submits the form built by `externalActivationForm` (browser only).
 *
 * @param {{action: string, method: string, fields: Record<string, string>}} spec
 * @param {Document} [doc]
 */
export function submitForm(spec, doc = document) {
  const form = doc.createElement('form');
  form.method = spec.method;
  form.action = spec.action;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(spec.fields)) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
}
