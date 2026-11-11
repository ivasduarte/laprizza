import { useTranslation } from 'react-i18next';
import { fieldMessage } from '../../api/error-text.js';
import './feedback.css';

/** Error text under one input. Pair it with `fieldProps()` so the id matches `aria-describedby`. */
export default function FieldError({ id, error }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p className="field-error" id={id}>
      {fieldMessage(t, error)}
    </p>
  );
}
