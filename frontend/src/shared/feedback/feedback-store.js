/**
 * Global feedback state: pending-request counter (loading indicator) and toasts.
 * Pure JS (same pattern as the session store) so it can be tested without React.
 *
 * @typedef {'success'|'info'|'warning'|'error'} ToastType
 * @typedef {Object} Toast
 * @property {string} id
 * @property {ToastType} type
 * @property {string} [messageKey] - i18n key (texts are translated at render time).
 * @property {object} [params] - i18n interpolation values.
 * @property {import('../api/error-normalizer.js').NormalizedError} [error] - Rendered through the error texts.
 * @property {string} dedupeKey - A toast with the same key is not stacked twice.
 * @property {number|null} autoDismissMs - `null` keeps it until dismissed.
 */

const AUTO_DISMISS_MS = {
  success: 5000,
  info: 6000,
  warning: null,
  error: null,
};
const MAX_TOASTS = 4;

export function createFeedbackStore() {
  let state = { pending: 0, toasts: [] };
  let sequence = 0;
  const listeners = new Set();

  function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    beginRequest() {
      setState({ pending: state.pending + 1 });
    },

    /** Never goes below zero, so an unbalanced call cannot leave the indicator stuck. */
    endRequest() {
      if (state.pending > 0) setState({ pending: state.pending - 1 });
    },

    /**
     * @param {{type: ToastType, messageKey?: string, params?: object, error?: object, dedupeKey?: string, autoDismissMs?: number|null}} toast
     * @returns {string} id of the (new or already existing) toast
     */
    notify({ type, messageKey, params, error, dedupeKey, autoDismissMs }) {
      const key = dedupeKey ?? `${type}:${messageKey ?? error?.kind ?? ''}`;
      const existing = state.toasts.find((toast) => toast.dedupeKey === key);
      if (existing) return existing.id;

      sequence += 1;
      const toast = {
        id: `toast-${sequence}`,
        type,
        messageKey,
        params,
        error,
        dedupeKey: key,
        autoDismissMs:
          autoDismissMs === undefined ? AUTO_DISMISS_MS[type] : autoDismissMs,
      };
      setState({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) });
      return toast.id;
    },

    dismiss(id) {
      if (state.toasts.some((toast) => toast.id === id)) {
        setState({ toasts: state.toasts.filter((toast) => toast.id !== id) });
      }
    },

    clear() {
      setState({ pending: 0, toasts: [] });
    },
  };
}

export const feedbackStore = createFeedbackStore();
