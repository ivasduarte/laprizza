# UI Consistency and Input Validation after the Sprint 2 Review

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-21

Technical Story: [WEB02] Consistent Layout and Navigation, [WEB03] Role-Based Navigation, [WEB04] User Feedback and Validation, [VIS04] Textures

## Context and Problem Statement

The client review of Sprint 2 listed problems common to the applications: several fonts, layouts that grow when data arrives, vague error messages, stock that can only be changed by increments, no sanity check on very large quantities, person names with digits or symbols, kitchen configurations with objects outside the kitchen or without textures, JSON errors without a line, and deep pages without a way back. How should the SPA and the API address them consistently?

## Decision Drivers

* The back end stays the authority: every rule enforced in the SPA is also enforced by the API.
* Messages say what is wrong and how to fix it, never internal details.
* No new dependencies.

## Decision Outcome

| # | Decision | Where |
|:--|:---------|:------|
| D1 | One typeface: the system UI font (`--font-app`), also in the JSON editors and in the lil-gui panel. | `index.css` |
| D2 | Loading placeholders reserve the room of the content that is coming (`Loading`, page 60vh, region 16rem); the menu lives behind ☰ so the header never changes size. | `loading.jsx`, `query-state.jsx`, `layout.jsx` |
| D3 | Breadcrumbs Home › Section › Page › Detail › Edit, built from the feature registry and the URL (`id`, `mode`). | `navigation.js` `breadcrumbTrail`, `breadcrumbs.jsx` |
| D4 | Password errors repeat the password policy; 5xx answers never include `details`. | `message.js`, `error-handler.js` |
| D5 | Stock accepts `set` (physical count) besides `increase`/`decrease`; the result must stay in 0..100 000; the SPA asks for confirmation of movements of 1000 units or more. | `stock.domain.js` `nextStockQuantity`, `stock-rules.js` |
| D6 | Customer names: letters with one space, apostrophe or hyphen between words; places may also use dots; every field has a maximum length. Same patterns and limits in Joi and in the SPA. | `customers.domain.js`, `validators.js` |
| D7 | Kitchen and assembly line: every object and the floor need a textured material; positions and sizes must fit the kitchen (or the line). | `material.domain.js`, `spatial/bounds.domain.js` |
| D8 | JSON editor with line numbers; syntax errors and API violations are reported with their line and the line is highlighted. | `json-editor.jsx`, `json-locations.js` |
| D9 | WEB03 verified: write actions of every page are rendered only with the matching permission (`useCan`), and form modes in the URL are ignored without it. | Feature pages |

## Consequences

* Configurations stored before D7 are still shown, but must be completed with textures (and moved inside the kitchen) before they can be saved again.
* The thresholds of D5 are constants in one place each (`MAX_STOCK_QUANTITY`, `UNUSUAL_CHANGE_UNITS`).
* The line of an API violation is found by parsing the editor text; if the text changed after the error, the line follows the current text.
