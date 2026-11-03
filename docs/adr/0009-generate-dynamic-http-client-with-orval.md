# Generate Dynamic HTTP Client with Orval

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Automate frontend HTTP client and type generation directly from the backend OpenAPI specification.

## Context and Problem Statement

The backend uses a Contract-First approach with OpenAPI. Manually writing fetch calls and data models in the frontend causes code duplication and frequent synchronization errors when the API contract changes.

## Decision Drivers

* Developer experience, type safety, and maintenance overhead reduction.

## Considered Options

* Manual fetch/axios implementation
* OpenAPI Generator (Java-based)
* Orval

## Decision Outcome

Chosen option: "Orval", because it seamlessly consumes the openapi.json and generates strongly-typed React hooks, ensuring that any backend contract break immediately triggers frontend compilation errors.

### Positive Consequences

* Guarantees absolute contract synchronization between frontend and backend, vastly speeding up integration tasks.

### Negative Consequences

* Developers must remember to run the generation script whenever the OpenAPI spec is updated before writing frontend logic.

## Pros and Cons of the Options

### Manual fetch/axios implementation

Writing custom HTTP requests and TypeScript interfaces by hand.

* Good, because it adds zero dependencies to the frontend project.
* Bad, because it is highly prone to human error and easily falls out of sync with the backend contract.

### OpenAPI Generator

A widely used tool to generate clients for various programming languages.

* Good, because it supports almost every client language and framework in existence.
* Bad, because it requires a Java runtime in the frontend build pipeline, complicating the developer setup.

### Orval

A tool tailored for the Node ecosystem that generates React Query hooks and TypeScript models from OpenAPI specs.

* Good, because it is native to the JavaScript ecosystem and eliminates all API integration boilerplate.
* Bad, because it adds a mandatory code-generation step to the build process.
