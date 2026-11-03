# Isolate Database Versioning with Migrations

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Introduce a migration tool to safely manage database schema and data evolution across different environments.

## Context and Problem Statement

The initial bootstrap script (seeder.js) successfully inserts base data but lacks version control. It is not scalable for sequential schema evolution or safe data transformations in production environments.

## Decision Drivers

* Traceability, rollback capability, and CI/CD automation compatibility.

## Considered Options

* Manual database scripts
* Mongoose Migrations
* migrate-mongo

## Decision Outcome

Chosen option: "migrate-mongo", because it provides predictable and reversible database state transitions that can be easily automated within the deployment pipeline.

### Positive Consequences

* Schema changes become safe, documented, and fully traceable across development, staging, and production environments.

### Negative Consequences

* Adds complexity to the CI/CD pipeline, as migrations must be executed automatically before starting the new backend version.

## Pros and Cons of the Options

### Manual database scripts

Writing custom Node.js or MongoDB shell scripts for each change.

* Good, because it requires no extra tools or libraries.
* Bad, because it provides no execution traceability or automated rollback mechanisms.

### Mongoose Migrations

A library that integrates migration logic tightly with Mongoose schemas.

* Good, because it interacts natively with the existing Object Document Mapper (ODM).
* Bad, because it is less actively maintained and strictly tied to Mongoose, limiting future flexibility.

### migrate-mongo

A framework-agnostic MongoDB migration tool.

* Good, because it cleanly isolates state changes into versioned files with up() and down() methods, recording executed migrations directly in the database.
* Bad, because it replaces the simplicity of a single seeder file with a more complex migration lifecycle.
