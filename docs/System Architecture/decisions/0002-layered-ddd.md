# ADR 0002: Layered Domain-Driven Design (DDD) Architecture

**Date:** 2026-09-26
**Status:** Accepted

## Context

The LaPrizza system requires a modular and maintainable architecture. The business rules must remain independent of presentation, persistence, and infrastructure mechanisms (ARC02). Additionally, the system must support automated testing (ARC05) without relying on complex mocking libraries.

## Decision

We will implement a Layered Domain-Driven Design (DDD) architecture. The system will be divided into four distinct layers:
1. **Presentation (API):** Handles HTTP requests, input validation, and routing.
2. **Application:** Contains use cases and orchestrates domain objects. Uses DTOs for input/output.
3. **Domain:** Encapsulates business logic, entities, value objects, and repository interfaces. Depends on nothing.
4. **Infrastructure:** Implements repository interfaces and handles persistence mapping.

For unit testing, we strictly forbid the use of mocking libraries (e.g., Mockito). Instead, we will use a **Dummy approach**, implementing lightweight, in-memory dummy classes that satisfy the domain's repository interfaces.

## Consequences

* **Positive:** Strict separation of concerns. The core business logic is isolated and highly testable. 
* **Positive:** The Dummy approach ensures tests run extremely fast and are decoupled from framework-specific mocking behaviors.
* **Negative:** Introduces additional boilerplate code (e.g., mapping between Domain Entities and Persistence Models, creating manual Dummy classes).