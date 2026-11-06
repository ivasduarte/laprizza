# Mock-Based Unit Testing

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

Sprint 1 enforced handwritten Dummy repositories. The team needs to speed up test development for backend services.

## Decision Drivers

* Development velocity.
* Maintenance overhead of handwritten Dummies.

## Considered Options

* Continue using handwritten Dummies
* Use `node:test` native mocking capabilities

## Decision Outcome

Chosen option: "Use node:test native mocking capabilities", because it accelerates testing without introducing external dependencies (like Sinon or Jest), provided the README DoD is updated accordingly.

### Positive Consequences

* Faster test writing and less boilerplate code to maintain.

### Negative Consequences

* Requires team alignment and a documentation update for the testing strategy.

## Pros and Cons of the Options

### Continue using handwritten Dummies

* Good, because it strictly avoids third-party mocking libraries
* Bad, because every new repository method requires updating the Dummy, slowing down feature development

### Use node:test native mocking capabilities

* Good, because Node.js >= 20 includes a built-in `mock` API, allowing stubbing without external libraries, matching the project's minimal dependency philosophy while reducing boilerplate
* Bad, because it deviates from the strict Sprint 1 definition of done
