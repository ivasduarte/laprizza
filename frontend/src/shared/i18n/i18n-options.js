import { DEFAULT_LANGUAGE, LANGUAGES, STORAGE_KEY } from './language.js';
import { messages } from './message.js';

export const i18nOptions = {
  resources: {
    en: { translation: messages.en },
    pt: { translation: messages.pt },
  },
  supportedLngs: LANGUAGES.map((language) => language.code),
  nonExplicitSupportedLngs: true,
  fallbackLng: DEFAULT_LANGUAGE,
  initAsync: false,
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: STORAGE_KEY,
  },
};
