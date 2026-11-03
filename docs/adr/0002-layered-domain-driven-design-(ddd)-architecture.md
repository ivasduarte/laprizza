# Layered Domain-Driven Design (DDD) Architecture

* Status: accepted
* Deciders: Development Team
* Date: 2026-09-26

## Context and Problem Statement

The LaPrizza system requires a modular and maintainable architecture where business rules remain independent of presentation, persistence, and infrastructure mechanisms (ARC02). Additionally, the system must support automated testing (ARC05) without relying on complex mocking libraries.

## Considered Options

* Layered DDD Architecture using Dummy approach for tests
* Traditional MVC (Model-View-Controller) Architecture
* Layered DDD Architecture using Mocking frameworks (e.g., Mockito)

## Decision Outcome

Chosen option: "Layered DDD Architecture using Dummy approach for tests", because it provides a strict separation of concerns into Presentation, Application, Domain, and Infrastructure layers, while relying on lightweight, in-memory dummy classes for testing.

## Pros and Cons of the Options

### Layered DDD Architecture using Dummy approach for tests

* Good, because the core business logic is isolated and highly testable, and the Dummy approach ensures tests run extremely fast, decoupled from framework-specific mocking behaviors.
* Bad, because it introduces additional boilerplate code, such as mapping between Domain Entities and Persistence Models, and requires creating manual Dummy classes.

### Traditional MVC (Model-View-Controller) Architecture

* Good, because it is universally understood and fast to scaffold.
* Bad, because it tightly couples business logic with infrastructure, making the domain hard to test in isolation.

### Layered DDD Architecture using Mocking frameworks

* Good, because writing mocks is faster than building full in-memory Dummies.
* Bad, because it strictly violates the project requirement that forbids the use of mocking libraries.
