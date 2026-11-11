import { useTranslation } from 'react-i18next';
import { errorMessage, fieldMessage } from '../../api/error-text.js';
import './feedback.css';

/**
 * Summary at the top of a form: field errors (client or API) as links to their inputs, plus
 * form-level API errors. Errors reported by a global toast (network, timeout, 5xx, 403) are not repeated.
 *
 * @param {Object} props
 * @param {Record<string, {type: string, limit?: number}>} [props.errors] - per-field map
 * @param {import('../../api/error-normalizer.js').NormalizedError | null} [props.error]
 * @param {Record<string, string>} [props.labels] - field -> translated label
 * @param {(field: string) => string} [props.idFor]
 */
export default function FormErrors({
  errors = {},
  error = null,
  labels = {},
  idFor,
}) {
  const { t } = useTranslation();
  const fields = Object.entries(errors);
  const formErrors = error && !error.global ? error.formErrors : [];
  const showMessage =
    error && !error.global && fields.length === 0 && formErrors.length === 0;

  if (fields.length === 0 && formErrors.length === 0 && !showMessage)
    return null;

  function focusField(event, field) {
    const target = idFor ? document.getElementById(idFor(field)) : null;
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  return (
    <div className="message message-error form-errors" role="alert">
      {showMessage ? (
        <strong>{errorMessage(t, error)}</strong>
      ) : (
        <>
          <strong>{t('feedback.fixFields')}</strong>
          <ul>
            {fields.map(([field, violation]) => (
              <li key={field}>
                <a
                  href={idFor ? `#${idFor(field)}` : '#'}
                  onClick={(event) => focusField(event, field)}
                >
                  {labels[field] ?? field}
                </a>
                : {fieldMessage(t, violation)}
              </li>
            ))}
            {formErrors.map((violation, index) => (
              <li key={`form-${index}`}>{fieldMessage(t, violation)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
