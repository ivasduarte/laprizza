import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SearchBar({
  value,
  onSearch,
  label,
  hint,
  maxLength = 100,
}) {
  const { t } = useTranslation();

  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [term, setTerm] = useState(value);

  useEffect(() => {
    setTerm(value);
  }, [value]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch(term.trim());
  };

  const handleClear = () => {
    setTerm('');
    onSearch('');
  };

  return (
    <form role="search" className="entity-search" onSubmit={handleSubmit}>
      <div>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type="search"
          value={term}
          maxLength={maxLength}
          onChange={(event) => setTerm(event.target.value)}
          aria-describedby={hint ? hintId : undefined}
        />
        {hint && (
          <p id={hintId} className="entity-hint">
            {hint}
          </p>
        )}
      </div>
      <div className="entity-actions">
        <button type="submit">{t('entity.search')}</button>
        {(value || term) && (
          <button type="button" className="secondary" onClick={handleClear}>
            {t('entity.clear')}
          </button>
        )}
      </div>
    </form>
  );
}
