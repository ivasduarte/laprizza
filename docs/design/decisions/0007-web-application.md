# ADR 0007: Web Application (SPA) Technology and Structure

**Date:** 2026-11-01
**Status:** Accepted

## Context and Problem Statement

Sprint 2 (WEB01) requires a single-page application (SPA) that gives every user role one integrated interface to the existing REST API, and that later hosts the 3D kitchen viewer (VIS01) and the AI pages (WEB07) while keeping the same navigation, authentication and visual identity. The System Specification does not mandate a technology, so the choice must be justified.

## Decision Outcome

- **React** with **Vite** as build tool and dev server. React is component-based, which lets the 3D viewer (Three.js) be mounted as a component inside a page; Vite gives fast, reproducible builds from `npm ci`.
- **React Router** for client-side routing, with one shared layout (logo, primary navigation, main area) rendered around every page.
- **Feature-based structure**: each feature lives in `src/features/<name>/` and is declared in `src/features/registry.js` (id, path, label, roles, lazy loader). Adding a page means adding a folder and one registry entry; the layout and other features are not changed. Pages are lazy-loaded, so the 3D viewer code is only downloaded when its page is opened.
- **One API client** (`src/shared/api`) is the only code that calls `fetch`. It uses the base URL from `VITE_API_BASE_URL`, can attach a bearer token supplied by the authentication feature, and raises a single error type (`ApiError`). Business identifiers are used exactly as returned by the back end (MongoDB `ObjectId`).
- **Configuration** through `VITE_*` environment variables documented in `.env.example`. These variables are part of the public bundle, so no secret or credential may be stored in them.
- Tests use the Node.js built-in runner without mocking libraries, consistent with the back end.

## Considered Options

- **Angular:** complete framework, but heavier and with more ceremony for a team that already uses JavaScript on the back end.
- **Vue:** also suitable; React was preferred for the team's familiarity and the ecosystem around Three.js.
- **Server-rendered pages:** do not fit the requirement of a SPA consuming the REST API.

## Consequences

- **Positive:** features can be developed and tested independently; the 3D and AI modules inherit layout and authentication by being registered as features.
- **Positive:** a single API client centralizes the base URL, authentication header and error type.
- **Negative:** JavaScript's dynamic typing means the shape of API responses is only checked by tests and the OpenAPI contract (ADR-0005).
