# Content Validation Strategy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

Kitchen configurations must be structurally correct and comply with physical business rules (e.g., valid dimensions, unique equipment IDs).

## Decision Drivers

* Clear error reporting to the user with exact property paths.
* Separation of structural validation from business logic.

## Considered Options

* Pure Domain-Driven validation
* JSON Schema plus domain rules

## Decision Outcome

Chosen option: "JSON Schema plus domain rules", because it leverages specialized libraries for deep object traversal and path-based error reporting, keeping the domain focused on business invariants.

### Positive Consequences

* Highly accurate error messages pointing to specific JSON paths.

### Negative Consequences

* Slight fragmentation of validation logic.

## Pros and Cons of the Options

### Pure Domain-Driven validation

* Good, because all logic resides in the domain entities
* Bad, because writing manual structural validation for deep JSON objects is error-prone and verbose

### JSON Schema plus domain rules

* Good, because a JSON Schema validator (like AJV or Joi) natively handles structure, types, and required fields, while the domain entity enforces business invariants (e.g., scale limits)
* Bad, because validation logic is split between a schema definition and domain code
