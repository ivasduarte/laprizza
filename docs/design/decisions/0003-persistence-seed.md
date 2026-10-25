# ADR 0003: Persistence and Seed Data Mechanism

**Date:** 2026-09-26
**Status:** Accepted

## Context

The system must persistently store business information and enforce referential consistency (ARC04). Furthermore, business concepts like Pizza Component Types, Pizza Sizes, Product Categories, and Allergens must be configurable and evolve without requiring source code changes (BCK03, BCK04, BCK06, BCK07).

## Decision

We will use **MongoDB** as our primary persistence database.
To satisfy the configurable data requirement, we will implement an automated **Seed Data Mechanism** in the infrastructure layer. Upon application startup, this mechanism will parse external configuration files (e.g., JSON) and populate the database with the initial required data (e.g., base dough, cheese, toppings) if it does not already exist.

## The Seeder Mechanism

### Why we did it and Advantages

Hardcoding domain reference data (such as the default `Pizza Component Types`) or initial access credentials (the first `MANAGER` account) into the source code violates the separation of concerns. It would require modifying the source code for simple business data changes.

The main advantages of the automated seeder approach include:

- **Environment Reproducibility:** Any developer, CI pipeline, or production environment can spin up a fresh database and instantly have the baseline data required to run the application properly.

- **Data-Driven Flexibility:** Business definitions (like minimum/maximum component quantities or assembly orders) live as configurable data in the database rather than hardcoded logic, perfectly fulfilling the requirement that they must evolve without code changes.

- **Security:** The initial Manager password is injected securely via an environment variable (`SEED\_MANAGER\_PASSWORD`) rather than being committed to version control.

### How it Works

The seeding process is executed automatically during the application's startup phase (in the `index.js` entry point), immediately after the MongoDB connection is established and right before the HTTP server starts listening for requests.

The mechanism is strictly **idempotent**, meaning it is safe to run multiple times without causing duplicates or errors:

1. **Validation Check:** It queries the database to check if the required baseline data already exists (e.g., checks if any user with the `MANAGER` role exists, and searches for default `Pizza Component Types` by name).

2. **Conditional Execution:** If the required data is already present, the seeder logs a bypass message and silently skips the operation, respecting any modifications previously made by administrators.

3. **Data Injection:** If the data is missing, it constructs the initial entities and persists them to the database.

## Consequences

- **Positive:** MongoDB provides schema flexibility, aligning well with the evolving nature of the product catalog.
- **Positive:** Seed data ensures a reproducible initialization state across different development and testing environments.
- **Negative:** Concurrent updates to stock levels (BCK09) will require specific concurrency control strategies (e.g., optimistic locking) within the MongoDB driver.
