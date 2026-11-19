import { useTranslation } from 'react-i18next';
import { dash } from './ai-format.js';
import { normalizeError } from '../../../shared/api/error-normalizer.js';
import { errorMessage } from '../../../shared/api/error-text.js';

/** "Name · v3" */
export function VersionLabel({ name, version }) {
  return (
    <>
      {dash(name)} <span className="ai-version">v{dash(version)}</span>
    </>
  );
}

/** Failure of a read (list/detail): translated text and a retry button. */
export function LoadError({ error, onRetry }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div className="message message-error" role="alert">
      {errorMessage(t, normalizeError(error))}{' '}
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          {t('feedback.retry')}
        </button>
      )}
    </div>
  );
}
