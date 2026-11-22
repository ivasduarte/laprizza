# Internationalization of the Web Application (English and Portuguese)

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Implement a robust internationalization architecture to support English and Portuguese across the Web Application, handling plurals, variables, and language persistence.

## Context and Problem Statement

WEB02 requires the interface to support English and Portuguese, with the selected language remaining consistent while the user navigates. Furthermore, upcoming Sprint 2 stories (feedback and validation messages, management pages with lists and counts) will require complex text rendering with variables and plurals.

## Decision Drivers

* Need for variable interpolation and pluralization, ease of maintenance, and bundle size footprint.

## Considered Options

* In-house solution (React context and dictionaries)
* Other libraries (e.g., FormatJS/react-intl)
* i18next with react-i18next

## Decision Outcome

Chosen option: "Other libraries", because it provides a complete, industry-standard solution for plurals and variables out of the box. Texts will live in dictionaries grouped by area in src/shared/i18n/messages.js, language preference will be persisted in localStorage (falling back to browser language, then English), and automated tests will guarantee key parity across languages.

### Positive Consequences

* Plurals, interpolation, and locale-aware formatting are available immediately when needed, preventing future component migrations. The automated key-parity test prevents untranslated texts from reaching the users.

### Negative Consequences

* Introduces three new dependencies and increases the bundle footprint. Additionally, messages returned by the backend (such as validation errors) are not translated by this mechanism, which must be addressed in conjunction with WEB04.

## Pros and Cons of the Options

### In-house solution

A custom state holding plain text dictionaries.

* Good, because it adds zero dependencies and is straightforward enough for two languages containing only plain texts.
* Bad, because plurals, interpolation, and formatting would have to be manually implemented and maintained by the team as soon as WEB04 and WEB05 require them.

### Other libraries

Alternative robust internationalization libraries.

* Good, because they are highly capable of handling complex internationalization scenarios.
* Bad, because they have less adoption in the current React ecosystem and rely on a heavier message format.

### i18next with react-i18next

The de facto standard internationalization ecosystem for React applications.

* Good, because it natively supports plurals, interpolation, and browser language detection out of the box with massive community support.
* Bad, because it introduces three new dependencies and an increase of about 64 kB (21 kB gzipped) in the main bundle.
