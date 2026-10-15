# ADR 0001: Back-End Platform and Technology Stack

**Date:** 2026-10-01
**Status:** Accepted

## Context

The LaPrizza system needs a back-end application to implement the core business logic, persistence, and REST APIs required for Sprint 1. The chosen technology must support our layered architecture and allow for rapid integration.

## Decision

We will use **Node.js (JavaScript)** as the primary platform for the back-end. 
For the HTTP web server and API routing, we will use the **Express** framework. 
Package and dependency management will be handled by **npm**.

## Consequences

* **Positive:** Node.js provides an asynchronous, non-blocking I/O model, which is highly efficient for data-intensive REST APIs.
* **Positive:** Express is unopinionated and does not force a specific folder structure, allowing us to cleanly implement our custom DDD layers.
* **Negative:** JavaScript's dynamic typing requires strict team discipline to ensure domain model integrity and DTO contracts, compared to statically typed languages.