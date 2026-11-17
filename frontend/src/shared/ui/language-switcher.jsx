import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/language.js';
import { GlobeIcon } from './icons.jsx';

/**
 * Segmented control with a sliding "dough ball" thumb.
 * Native radio buttons: arrow keys, focus and screen readers work out of the box.
 * The visible text is the 2-letter code (fixed width); the accessible name is the full
 * language name, written in that language.
 */
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const name = useId();
  const current = Math.max(
    0,
    LANGUAGES.findIndex(({ code }) => code === i18n.resolvedLanguage)
  );

  return (
    <fieldset
      className="lang-switch"
      style={{ '--lang-count': LANGUAGES.length, '--lang-index': current }}
    >
      <legend className="visually-hidden">{t('language.label')}</legend>
      <GlobeIcon className="lang-switch-globe" width={16} height={16} />
      <span className="lang-switch-track">
        <span className="lang-switch-thumb" aria-hidden="true" />
        {LANGUAGES.map(({ code, name: languageName }) => (
          <label key={code} className="lang-switch-option" title={languageName}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={code}
              checked={i18n.resolvedLanguage === code}
              onChange={() => i18n.changeLanguage(code)}
            />
            <span aria-hidden="true">{code.toUpperCase()}</span>
            <span className="visually-hidden" lang={code}>
              {languageName}
            </span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
