import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { i18nOptions } from './i18n-options.js';

i18n.use(LanguageDetector).use(initReactI18next).init(i18nOptions);

const updateDocumentLanguage = (language) => {
  document.documentElement.lang = language;
};

updateDocumentLanguage(i18n.resolvedLanguage);
i18n.on('languageChanged', () => updateDocumentLanguage(i18n.resolvedLanguage));

export default i18n;
