# Atomic Activation Strategy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

Only one kitchen configuration can be active at a time. Switching the active configuration must be atomic so the system is never without an active configuration or with two active ones.

## Decision Drivers

* Data consistency.
* MongoDB capabilities and local development constraints.

## Considered Options

* Single active pointer document
* Boolean flag with partial unique index and transaction

## Decision Outcome

Chosen option: "Boolean flag with partial unique index and transaction", because data consistency is paramount. Local environments will need to be configured as single-node replica sets (supported natively in modern local dev setups or via Docker).

### Positive Consequences

* Strict database-level guarantee of uniqueness and atomicity.

### Negative Consequences

* Increased setup complexity for local development environments.

## Pros and Cons of the Options

### Single active pointer document

* Good, because swapping an ID in a single singleton document is inherently atomic
* Bad, because it requires fetching two different collections to get the active configuration

### Boolean flag with partial unique index and transaction

* Good, because `isActive: true` with a partial unique index guarantees at most one active document natively. Using a multi-document transaction allows swapping (deactivating the old, activating the new) safely
* Bad, because MongoDB multi-document transactions require a replica set (like MongoDB Atlas), which breaks local standalone MongoDB setups.
