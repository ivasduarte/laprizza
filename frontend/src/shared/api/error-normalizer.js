/**
 * Turns any error thrown by the HTTP client into a UI-agnostic description.
 * The raw `error.message` is never exposed: texts are translated by `kind`/`code`/`type`.
 *
 * @typedef {'validation'|'unauthenticated'|'forbidden'|'notFound'|'conflict'|'rateLimited'|'network'|'timeout'|'server'|'unknown'} ErrorKind
 *
 * @typedef {Object} FieldError
 * @property {string} field - API path of the input (e.g. `name`, `address.postalCode`); `''` for form-level errors.
 * @property {string} type - Stable validation type (e.g. `any.required`, `string.min`).
 * @property {number} [limit] - Violated numeric limit.
 * @property {string} [raw] - Diagnostic text from a legacy `string[]` detail (kitchen JSON violations only).
 *
 * @typedef {Object} NormalizedError
 * @property {ErrorKind} kind
 * @property {number} status
 * @property {string|null} code
 * @property {number|null} retryAfterSeconds
 * @property {boolean} outcomeUnknown - A write was sent but no answer arrived: it may have been executed.
 * @property {boolean} global - Reported by a global toast instead of inline in the form.
 * @property {FieldError[]} fieldErrors
 * @property {FieldError[]} formErrors
 */

/** Kinds that no form can explain inline: they are reported by a global toast. */
const GLOBAL_KINDS = new Set(['network', 'timeout', 'server', 'forbidden']);

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

/** @returns {ErrorKind} */
export function kindOf(error) {
  if (error?.code === 'TIMEOUT') return 'timeout';
  if (error?.code === 'NETWORK_ERROR' || error?.status === 0) return 'network';
  const status = error?.status;
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Accepts the structured `{ field, type, message, limit? }` items and the legacy plain strings.
 * The technical `message` of structured items is deliberately dropped.
 *
 * @param {unknown} details
 * @returns {{ fieldErrors: FieldError[], formErrors: FieldError[] }}
 */
export function normalizeDetails(details) {
  const fieldErrors = [];
  const formErrors = [];
  if (!Array.isArray(details)) return { fieldErrors, formErrors };

  for (const item of details) {
    if (item && typeof item === 'object' && typeof item.type === 'string') {
      const entry = { field: String(item.field ?? ''), type: item.type };
      if (typeof item.limit === 'number') entry.limit = item.limit;
      (entry.field ? fieldErrors : formErrors).push(entry);
    } else if (typeof item === 'string' && item) {
      formErrors.push({ field: '', type: 'content.invalid', raw: item });
    }
  }
  return { fieldErrors, formErrors };
}

/** @returns {NormalizedError} */
export function normalizeError(error) {
  const kind = kindOf(error);
  // Details only make sense for validation errors; anywhere else they could carry internals.
  const { fieldErrors, formErrors } = normalizeDetails(
    kind === 'validation' ? error?.details : null
  );
  return {
    kind,
    status: Number.isInteger(error?.status) ? error.status : 0,
    code: typeof error?.code === 'string' ? error.code : null,
    retryAfterSeconds: error?.retryAfterSeconds ?? null,
    outcomeUnknown: Boolean(error?.outcomeUnknown),
    global: GLOBAL_KINDS.has(kind),
    fieldErrors,
    formErrors,
  };
}
