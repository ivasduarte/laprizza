/**
 * Promise-based confirmation dialogs (replacement for window.confirm).
 * Requests are queued: only one dialog is open at a time.
 *
 * @typedef {Object} ConfirmOptions
 * @property {string} messageKey - i18n key of the question.
 * @property {object} [params]
 * @property {string} [titleKey]
 * @property {string} [confirmKey]
 * @property {string} [cancelKey]
 * @property {'danger'|'default'} [tone]
 */

export function createConfirmStore() {
  let state = { current: null };
  let currentResolve = null;
  const queue = [];
  const listeners = new Set();

  function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function showNext() {
    const next = queue.shift();
    if (!next) return;
    currentResolve = next.resolve;
    setState({ current: next.options });
  }

  function settle(result) {
    if (!currentResolve) return;
    const resolve = currentResolve;
    currentResolve = null;
    setState({ current: null });
    resolve(result);
    showNext();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** @param {ConfirmOptions} options @returns {Promise<boolean>} */
    request(options) {
      return new Promise((resolve) => {
        queue.push({ options, resolve });
        if (!currentResolve) showNext();
      });
    },
    confirm: () => settle(true),
    cancel: () => settle(false),
  };
}

export const confirmStore = createConfirmStore();
