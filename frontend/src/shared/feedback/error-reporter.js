import { isAbortError, normalizeError } from '../api/error-normalizer.js';

/**
 * Policy for failures nobody handles inline: network, timeout, 5xx and 403 become a toast.
 * 4xx errors (validation, conflict, bad credentials...) are explained inline by the form,
 * and a 401 with a session is handled by the session store (login page message).
 */
export function createErrorReporter({ store, normalize = normalizeError }) {
  return function report(error, meta = {}) {
    if (isAbortError(error) || meta.feedback === 'silent') return;
    const normalized = normalize(error);
    if (!normalized.global) return;
    store.notify({
      type: 'error',
      error: normalized,
      dedupeKey: `error:${normalized.kind}:${normalized.code ?? ''}`,
    });
  };
}
