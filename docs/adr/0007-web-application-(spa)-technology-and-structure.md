# Web Application (SPA) Technology and Structure

* Status: accepted
* Deciders: Development Team
* Date: 2026-10-12

## Context and Problem Statement

Sprint 2 (WEB01) requires a single-page application (SPA) that provides one integrated interface for the existing REST API. It must later host the 3D kitchen viewer (VIS01) and AI pages (WEB07) while maintaining consistent navigation and authentication.

## Considered Options

* React with Vite and Feature-based Structure
* Angular
* Vue
* Server-rendered pages

## Decision Outcome

Chosen option: "React with Vite and Feature-based Structure", because React is component-based (perfect for mounting Three.js), Vite provides fast and reproducible builds, and the feature-based lazy-loaded structure scales well.

## Pros and Cons of the Options

### React with Vite and Feature-based Structure

* Good, because features can be developed independently, the 3D/AI modules inherit layout/authentication automatically, and a single API client centralizes base URLs and auth headers.
* Bad, because JavaScript's dynamic typing means the shape of API responses is only checked by tests and the OpenAPI contract.

### Angular

* Good, because it is a complete framework with built-in HTTP clients and routing.
* Bad, because it is heavier and requires more ceremony for a team that already uses standard JavaScript on the backend.

### Vue

* Good, because it is lightweight and adaptable.
* Bad, because React was preferred due to the team's familiarity and the robust ecosystem around Three.js.

### Server-rendered pages

* Good, because of faster initial load times.
* Bad, because they do not fit the requirement of building a SPA that consumes a REST API.
