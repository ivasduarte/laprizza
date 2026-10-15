# ADR 0003: Persistence and Seed Data Mechanism

**Date:** 2026-09-26
**Status:** Accepted

## Context

The system must persistently store business information and enforce referential consistency (ARC04). Furthermore, business concepts like Pizza Component Types, Pizza Sizes, Product Categories, and Allergens must be configurable and evolve without requiring source code changes (BCK03, BCK04, BCK06, BCK07). 

## Decision

We will use **MongoDB** as our primary persistence database. 
To satisfy the configurable data requirement, we will implement an automated **Seed Data Mechanism** in the infrastructure layer. Upon application startup, this mechanism will parse external configuration files (e.g., JSON) and populate the database with the initial required data (e.g., base dough, cheese, toppings) if it does not already exist.

## Consequences

* **Positive:** MongoDB provides schema flexibility, aligning well with the evolving nature of the product catalog.
* **Positive:** Seed data ensures a reproducible initialization state across different development and testing environments.
* **Negative:** Concurrent updates to stock levels (BCK09) will require specific concurrency control strategies (e.g., optimistic locking) within the MongoDB driver.