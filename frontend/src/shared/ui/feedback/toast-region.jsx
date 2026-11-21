import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { feedbackStore } from '../../feedback/feedback-store.js';
import { useFeedbackState } from '../../feedback/use-feedback.js';
import { errorMessage } from '../../api/error-text.js';
import './feedback.css';

function Toast({ toast }) {
  const { t } = useTranslation();
  // Paused while the user reads it (hover) or reaches it with the keyboard (focus), so a
  // short timeout never removes a message mid-reading (WCAG 2.2.1); it restarts on leave.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast.autoDismissMs || paused) return undefined;
    const timer = setTimeout(
      () => feedbackStore.dismiss(toast.id),
      toast.autoDismissMs
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.autoDismissMs, paused]);

  const text = toast.error
    ? errorMessage(t, toast.error)
    : t(toast.messageKey, toast.params);
  const urgent = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      className={`toast toast-${toast.type}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <p role={urgent ? 'alert' : 'status'}>{text}</p>
      <button
        type="button"
        className="ghost small"
        aria-label={t('feedback.dismiss')}
        onClick={() => feedbackStore.dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function ToastRegion() {
  const { t } = useTranslation();
  const { toasts } = useFeedbackState();

  return (
    <div
      className="toast-region"
      role="region"
      aria-label={t('feedback.notifications')}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
