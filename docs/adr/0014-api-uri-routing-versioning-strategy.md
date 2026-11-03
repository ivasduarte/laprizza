# API URI Routing Versioning Strategy

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Implement an API versioning strategy to support future breaking changes without breaking older clients.

## Context and Problem Statement

API contracts will inevitably evolve. Breaking changes need to be introduced gracefully, ensuring that existing clients (like cached frontend browsers or mobile apps) continue to function during the migration period.

## Decision Drivers

* Visibility, client integration ease, and API standard practices.

## Considered Options

* Versioning via HTTP Accept Header
* Versioning via Query Parameters
* Versioning via URI Routing

## Decision Outcome

Chosen option: "Versioning via URI Routing", because breaking changes will force the creation of a new router (e.g., /api/v2/), keeping old controllers intact in the previous version until formal deprecation.

### Positive Consequences

* Frontend clients can easily target the correct API version, and backend logs clearly distinguish which version is receiving traffic.

### Negative Consequences

* The codebase will temporarily hold duplicated logic for routes that exist in both v1 and v2 during deprecation windows.

## Pros and Cons of the Options

### Versioning via HTTP Accept Header

Requiring clients to pass version specifications in the request headers.

* Good, because URLs remain clean, semantic, and strictly follow REST principles.
* Bad, because it makes API caching and direct browser testing significantly harder to manage.

### Versioning via Query Parameters

Appending ?version=2 to existing endpoints.

* Good, because it is easy to append to any URL without restructuring the routing tree.
* Bad, because it clutters the URL and is considered an anti-pattern for major REST API versioning.

### Versioning via URI Routing

Prefixing the routes directly in the URL path (e.g., /api/v1/).

* Good, because it provides explicit integration for clients, clear visibility in monitoring tools, and simplifies routing logic.
* Bad, because it may cause temporary code duplication across controllers during transition phases.
