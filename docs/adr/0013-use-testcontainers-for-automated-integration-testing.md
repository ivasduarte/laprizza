# Use Testcontainers for Automated Integration Testing

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Ensure integration tests run against a real, isolated MongoDB instance.

## Context and Problem Statement

Unit tests currently use in-memory Dummies. Integration tests require validation against the actual MongoDB engine to ensure query correctness, but shared databases cause state conflicts between test executions.

## Decision Drivers

* Test reliability, environment parity, and state isolation.

## Considered Options

* Shared Cloud Database
* MongoDB Memory Server
* Testcontainers

## Decision Outcome

Chosen option: "Testcontainers", because it instantiates an ephemeral Docker container using the exact MongoDB production image for the precise duration of the test suite, guaranteeing environment parity.

### Positive Consequences

* Eliminates flaky tests caused by dirty database states and ensures queries will behave exactly as they do in production.

### Negative Consequences

* Increases the boot time of the test suite as the Docker container needs to be pulled and started before tests execute.

## Pros and Cons of the Options

### Shared Cloud Database

Connecting the test suite to a remote staging database.

* Good, because it reflects a real network and infrastructure environment.
* Bad, because concurrent test runs mutate the same state, causing flaky tests and data corruption.

### MongoDB Memory Server

A Node.js library that spins up an actual MongoDB server in memory.

* Good, because it runs entirely within the Node.js process and boots very fast.
* Bad, because it does not guarantee 100% parity with the real MongoDB production engine behavior and features.

### Testcontainers

A library that provisions disposable Docker containers for tests.

* Good, because it provides absolute parity with production infrastructure and total state isolation for every test suite run.
* Bad, because it requires the Docker daemon to be active on both local development machines and CI runners.
