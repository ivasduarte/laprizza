# Use Architecture Decision Records (ADRs)

* Status: accepted
* Deciders: Development Team
* Date: 2026-09-25

## Context and Problem Statement

The project requires a historical log of architectural and technological decisions. The lack of documentation leads to a loss of context regarding the trade-offs considered and forces the team to re-evaluate already solved problems.

## Considered Options

* Architecture Decision Records (ADRs) in the repository
* Tribal knowledge (no documentation)
* External Wiki

## Decision Outcome

Chosen option: "Architecture Decision Records (ADRs) in the repository", because it keeps the documentation tightly coupled with the codebase, allowing reviews within the same Pull Request.

## Pros and Cons of the Options

### Architecture Decision Records (ADRs) in the repository

* Good, because decisions are version-controlled alongside the code and reviewed together.
* Bad, because it requires strict team discipline to write the record before implementing the change.

### Tribal knowledge

* Good, because it requires zero effort.
* Bad, because context is permanently lost when team members leave.

### External Wiki

* Good, because it centralizes all company documentation in one platform.
* Bad, because it easily becomes outdated and disconnected from the code changes it refers to.
