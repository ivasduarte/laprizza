# Contract-First REST API

* Status: accepted
* Deciders: Development Team
* Date: 2026-09-26

## Context and Problem Statement

The business functionality developed in Sprint 1 must be exposed via REST APIs to be consumed by different clients in the future (Web Application, 3D Visualization, AI module) (ARC03).

## Considered Options

* Contract-First approach using OpenAPI
* Code-First API Generation
* GraphQL

## Decision Outcome

Chosen option: "Contract-First approach using OpenAPI", because defining endpoints, parameters, and payloads before implementation establishes a clear, machine-readable contract for future integrations, coupled with URI-level versioning.

## Pros and Cons of the Options

### Contract-First approach using OpenAPI

* Good, because clear contracts mitigate integration risks for future Sprints, and API versioning allows future breaking changes without affecting existing clients.
* Bad, because it requires strict discipline from the team to update the documentation before altering the code.

### Code-First API Generation

* Good, because the documentation is always synchronized with the code.
* Bad, because frontend teams must wait for the backend to be implemented before they can understand the data structure.

### GraphQL

* Good, because clients can request exactly the data they need.
* Bad, because it does not fit the specific requirement to build REST APIs (ARC03).
