import { isAbortError, normalizeError } from '../api/error-normalizer.js';

/**
 * Synchronous in-flight lock for one form/action. A ref-style flag (not React state), so two
 * clicks in the same tick cannot both pass: `disabled={submitting}` alone leaves that window open.
 *
 * `run` never throws: it resolves `{ ok: true, value }`, `{ ok: false, error }` (normalized),
 * `{ ok: false, skipped: true }` (a run was already in progress) or `{ ok: false, aborted: true }`.
 */
export function createSubmitGuard({ onUnexpected = console.error } = {}) {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(action) {
      if (busy) return { ok: false, skipped: true };
      busy = true;
      try {
        return { ok: true, value: await action() };
      } catch (error) {
        if (isAbortError(error)) return { ok: false, aborted: true };
        if (!Number.isInteger(error?.status)) onUnexpected(error); // a bug, not an API error
        return { ok: false, error: normalizeError(error) };
      } finally {
        busy = false;
      }
    },
  };
}
