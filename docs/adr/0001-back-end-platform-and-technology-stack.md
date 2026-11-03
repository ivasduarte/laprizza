# Back-End Platform and Technology Stack

* Status: accepted
* Deciders: Development Team
* Date: 2026-10-01

## Context and Problem Statement

The LaPrizza system needs a back-end application to implement the core business logic, persistence, and REST APIs required for Sprint 1. The chosen technology must support our layered architecture, handle data-intensive REST APIs efficiently, and allow for rapid integration.

## Considered Options

* Node.js with Express
* Java with Spring Boot
* Python with Django

## Decision Outcome

Chosen option: "Node.js with Express", because its asynchronous, non-blocking I/O model is highly efficient for REST APIs, and its unopinionated nature allows us to cleanly implement our custom Domain-Driven Design (DDD) layers.

## Pros and Cons of the Options

### Node.js with Express

* Good, because it handles concurrent requests efficiently and does not force a specific folder structure, perfectly accommodating custom DDD layers.
* Bad, because JavaScript's dynamic typing requires strict team discipline to ensure domain model integrity and DTO contracts.

### Java with Spring Boot

* Good, because static typing natively protects domain integrity.
* Bad, because it introduces heavier boilerplate and a highly opinionated structure that fights against custom DDD implementations.

### Python with Django

* Good, because of its fast development cycle.
* Bad, because its tightly coupled ORM mixes infrastructure with business logic, violating DDD principles.
