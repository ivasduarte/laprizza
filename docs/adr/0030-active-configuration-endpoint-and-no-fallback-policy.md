# Active Configuration Endpoint and No-Fallback Policy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

The 3D viewer needs to fetch the active layout. We must decide how to handle the absence of an active configuration.

## Decision Drivers

* Predictability of the API.
* Role-based access control (Manager and Staff).

## Considered Options

* Provide a hardcoded fallback layout
* Dedicated endpoint with strict 404 No-Fallback

## Decision Outcome

Chosen option: "Dedicated endpoint with strict 404 No-Fallback", because explicit failure is preferable to silent misconfiguration in a professional environment.

### Positive Consequences

* Clear API contract and reliable state representation.

### Negative Consequences

* Requires robust error handling in the 3D viewer frontend.

## Pros and Cons of the Options

### Provide a hardcoded fallback layout

* Good, because the viewer always renders something
* Bad, because it masks operational issues and hides the fact that the system is misconfigured

### Dedicated endpoint with strict 404 No-Fallback

* Good, because it adheres to fail-fast principles, forcing the manager to actively resolve the missing configuration
* Bad, because the viewer will show an empty state or error screen
