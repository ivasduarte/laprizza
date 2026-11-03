# Schedule E2E Tests in Nightly Builds

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Automate End-to-End (E2E) testing without blocking the CI/CD pull request pipeline.

## Context and Problem Statement

End-to-end system validation is required to guarantee overall stability. However, running full browser-based E2E tests on every Pull Request blocks the workflow due to unacceptably high execution times.

## Decision Drivers

* Pipeline execution speed, system reliability, and resource usage.

## Considered Options

* E2E tests on every Pull Request
* Scheduled Nightly Builds

## Decision Outcome

Chosen option: "Scheduled Nightly Builds", because they will run daily via a schedule trigger in GitHub Actions against a staging environment, validating critical user journeys without delaying the daily CI cycle.

### Positive Consequences

* Development speed is maintained, and CI resource costs are kept low while still providing holistic system validation.

### Negative Consequences

* If a critical E2E bug is introduced during the day, developers will only be notified the following morning.

## Pros and Cons of the Options

### E2E tests on every Pull Request

Triggering the full E2E suite as a mandatory check for merging code..

* Good, because it guarantees no integration breaks enter the main branch.
* Bad, because it drastically slows down developer feedback loops and consumes excessive CI minutes.

### Scheduled Nightly Builds

Running the E2E suite once a day during off-hours against a dedicated staging environment.

* Good, because t keeps PR validation fast while ensuring continuous end-to-end coverage over the integrated codebase.
* Bad, because feedback on integration failures is delayed until the next day, potentially allowing bugs to exist in the main branch overnight.
