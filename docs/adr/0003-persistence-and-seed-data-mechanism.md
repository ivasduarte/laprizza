# Persistence and Seed Data Mechanism

* Status: accepted
* Deciders: Development Team
* Date: 2026-09-26

## Context and Problem Statement

The system must persistently store business information and enforce referential consistency (ARC04). Furthermore, business concepts like Pizza Component Types and Allergens must be configurable and evolve without requiring source code changes (BCK03, BCK04, BCK06, BCK07).

## Considered Options

* MongoDB with Automated Seed Data Mechanism
* MongoDB with Hardcoded Business Data
* Relational Database (SQL)

## Decision Outcome

Chosen option: "MongoDB with Automated Seed Data Mechanism", because MongoDB aligns well with the evolving nature of the product catalog, and an idempotent automated seeder parses external JSON configurations upon startup to populate missing baseline data.

## Pros and Cons of the Options

### MongoDB with Automated Seed Data Mechanism

* Good, because it ensures environment reproducibility, provides data-driven flexibility without code changes, and allows secure credential injection (e.g., SEED_MANAGER_PASSWORD).
* Bad, because concurrent updates to stock levels will require specific concurrency control strategies (e.g., optimistic locking) within the MongoDB driver.

### MongoDB with Hardcoded Business Data

* Good, because it is simple to implement.
* Bad, because it violates the separation of concerns and requires modifying the source code for simple business data changes.

### Relational Database

* Good, because referential integrity is guaranteed at the database level.
* Bad, because strict schemas reduce the flexibility needed for the evolving product catalog.
