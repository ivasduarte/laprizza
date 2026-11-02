import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/language.js';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const selectId = useId();

  return (
    <div className="language-switcher">
      <label htmlFor={selectId}>{t('language.label')}</label>
      <select
        id={selectId}
        value={i18n.resolvedLanguage}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
      >
        {LANGUAGES.map(({ code, name }) => (
          <option key={code} value={code} lang={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
