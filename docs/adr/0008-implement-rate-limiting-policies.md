# Implement Rate Limiting Policies

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Protect API endpoints from volumetric and brute-force attacks to maintain high availability and security.

## Context and Problem Statement

The REST API currently lacks request throttling. Critical endpoints, such as the authentication route, are exposed to brute-force credential stuffing, and general endpoints can be easily overwhelmed by Denial of Service (DoS) attacks.

## Decision Drivers

* Security against brute-force attacks, system stability under high load, and ease of implementation.

## Considered Options

* Web Application Firewall (WAF)
* API Gateway Rate Limiting
* express-rate-limit middleware

## Decision Outcome

Chosen option: "express-rate-limit middleware", because t provides immediate, application-level mitigation of DoS and brute-force attempts without requiring complex infrastructure changes.

### Positive Consequences

* Instantly secures the /auth/login route and limits general API abuse with minimal configuration.

### Negative Consequences

* The in-memory state tracking will eventually require a transition to an external store (e.g., Redis) if horizontal scaling is introduced.

## Pros and Cons of the Options

### Web Application Firewall

A network security system that monitors and filters incoming HTTP traffic.

* Good, because it blocks malicious traffic before it ever reaches the Node.js server.
* Bad, because it requires external cloud infrastructure provisioning and incurs additional costs.

### API Gateway Rate Limiting

A centralized reverse proxy that manages rate limits across multiple services.

* Good, because it offloads the rate-limiting computation from the application layer.
* Bad, because it adds an unnecessary infrastructure layer for the current monolithic scope.

### express-rate-limit middleware

A Node.js library that implements basic rate-limiting directly within Express routes.

* Good, because it is easy to configure and deploy immediately within the existing codebase.
* Bad, because its default in-memory store becomes inaccurate if the backend scales horizontally to multiple instances.
