import { useCallback, useState } from 'react';
import { createSubmitGuard } from './submit-guard.js';
import { feedbackStore } from '../feedback/feedback-store.js';

/**
 * Runs a form action once at a time and exposes `submitting` and the normalized `error`.
 * Form values live in the component, so they are never cleared here (input preservation).
 *
 * const { submit, submitting, error } = useSubmit();
 * const result = await submit(() => api.post(...), { successKey: 'x.saved' });
 */
export function useSubmit() {
  const [guard] = useState(() => createSubmitGuard());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(
    async (action, { successKey, successParams } = {}) => {
      if (guard.isBusy()) return { ok: false, skipped: true };
      setSubmitting(true);
      setError(null);
      const result = await guard.run(action);
      setSubmitting(false);
      if (result.ok && successKey) {
        feedbackStore.notify({
          type: 'success',
          messageKey: successKey,
          params: successParams,
        });
      } else if (result.error) {
        setError(result.error);
      }
      return result;
    },
    [guard]
  );

  const clearError = useCallback(() => setError(null), []);
  return { submit, submitting, error, clearError };
}
