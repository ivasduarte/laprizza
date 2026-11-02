# ADR 0008: Internationalization of the Web Application (English and Portuguese)

**Date:** 2026-11-02
**Status:** Accepted

## Context and Problem Statement

WEB02 requires the interface to support English and Portuguese, with the selected language remaining consistent while the user navigates. The following Sprint 2 stories (feedback and validation messages, management pages with lists and counts) will need texts with variables and plurals.

## Decision Outcome

- Use **i18next** with **react-i18next** (and **i18next-browser-languagedetector**), the de facto standard for React applications.
- Texts live in one dictionary per language in `src/shared/i18n/messages.js`, grouped by area (`layout`, `nav`, `home`, ...). Components and the feature registry refer to texts by key (`t('home.title')`, `labelKey: 'nav.home'`), never by literal string.
- The configuration is in `src/shared/i18n/i18n-options.js`, free of side effects so it can be tested; `i18n.js` initializes the library once, imported by `main.jsx`. Resources are bundled, so initialization is synchronous.
- **Language selection:** the language previously chosen by the user (stored in `localStorage`, key `laprizza.language`), otherwise the browser language, otherwise English. Regional variants such as `pt-PT` use `pt`.
- The initialization is global, so the language does not change when the user navigates between pages. `<html lang>` is updated whenever the language changes.
- A missing translation never breaks a page: it falls back to English and, at last, to the key.
- Automated tests guarantee that every language has exactly the same keys, that every menu entry is translated, and that the configuration resolves languages and fallbacks as described.

## Considered Options

- **In-house solution** (React context and dictionaries): no dependency and enough for two languages and plain texts, but plurals, interpolation and formatting would have to be implemented and maintained by the team as soon as WEB04 and WEB05 need them.
- **Other libraries** (for example FormatJS/react-intl): capable, but with less adoption in the React ecosystem and a heavier message format.

## Consequences

- **Positive:** plurals, interpolation and locale-aware formatting are available when needed, with no later migration of the components.
- **Positive:** the key-parity test prevents untranslated texts from reaching users.
- **Negative:** three new dependencies and an increase of about 64 kB (21 kB gzipped) in the main bundle.
- **Negative:** messages returned by the back end (for example validation errors) are not translated by this mechanism; this must be addressed together with WEB04.
