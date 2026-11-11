import { useTranslation } from 'react-i18next';
import { useFeedbackState } from '../../feedback/use-feedback.js';
import './feedback.css';

/** Non-blocking loading bar driven by the pending-request counter (shown after a short delay). */
export default function GlobalProgress() {
  const { t } = useTranslation();
  const { pending } = useFeedbackState();
  const active = pending > 0;

  return (
    <div className="global-progress" data-active={active} role="status">
      <span className="global-progress-bar" aria-hidden="true" />
      {active && (
        <span className="visually-hidden">{t('feedback.loading')}</span>
      )}
    </div>
  );
}
