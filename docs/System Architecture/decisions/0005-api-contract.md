# ADR 0005: Contract-First REST API

**Date:** 2026-09-26
**Status:** Accepted

## Context

The business functionality developed in Sprint 1 must be exposed via REST APIs to be consumed by different clients in the future (Web Application, 3D Visualization, AI module) (ARC03). 

## Decision

We adopt a **Contract-First approach** using the **OpenAPI specification**. 
Before implementing any endpoint, its contract (paths, parameters, request bodies, and HTTP status codes) must be defined in an OpenAPI document. 
Additionally, the API routes will be versioned at the URL level (e.g., `/api/v1/...`).

## Consequences

* **Positive:** Clear, machine-readable contracts establish an exact integration point for future Sprints, mitigating integration risks.
* **Positive:** API versioning allows future breaking changes without affecting existing clients.
* **Negative:** Requires strict discipline from the team to update the documentation before altering the code.