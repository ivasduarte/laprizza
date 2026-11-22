# Implement Rate Limiting Policies

- Status: accepted, amended (See Amendments)
- Deciders: Development Team
- Date: 2026-11-02

Technical Story: Protect API endpoints from volumetric and brute-force attacks to maintain high availability and security.

## Context and Problem Statement

The REST API currently lacks request throttling. Critical endpoints, such as the authentication route, are exposed to brute-force credential stuffing, and general endpoints can be easily overwhelmed by Denial of Service (DoS) attacks.

## Decision Drivers

- Security against brute-force attacks, system stability under high load, and ease of implementation.

## Considered Options

- Web Application Firewall (WAF)
- API Gateway Rate Limiting
- express-rate-limit middleware

## Decision Outcome

Chosen option: "express-rate-limit middleware", because t provides immediate, application-level mitigation of DoS and brute-force attempts without requiring complex infrastructure changes.

### Positive Consequences

- Instantly secures the /auth/login route and limits general API abuse with minimal configuration.

### Negative Consequences

- The in-memory state tracking will eventually require a transition to an external store (e.g., Redis) if horizontal scaling is introduced.

## Pros and Cons of the Options

### Web Application Firewall

A network security system that monitors and filters incoming HTTP traffic.

- Good, because it blocks malicious traffic before it ever reaches the Node.js server.
- Bad, because it requires external cloud infrastructure provisioning and incurs additional costs.

### API Gateway Rate Limiting

A centralized reverse proxy that manages rate limits across multiple services.

- Good, because it offloads the rate-limiting computation from the application layer.
- Bad, because it adds an unnecessary infrastructure layer for the current monolithic scope.

### express-rate-limit middleware

A Node.js library that implements basic rate-limiting directly within Express routes.

- Good, because it is easy to configure and deploy immediately within the existing codebase.
- Bad, because its default in-memory store becomes inaccurate if the backend scales horizontally to multiple instances.

## Amendments

- AA01 ([ADR 0022](0022-local-login-without-account-enumeration-and-with-progressive-lockout.md), [ADR 0023](0023-password-recovery-with-single-use-hashed-tokens.md)): the policies applied to the authentication routes are:

  | Limiter  | Routes                                           | Limit per IP      | Counts                                                 | Variables                                                   |
  | -------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
  | `login`  | `POST /auth/login`, `POST /auth/password/change` | 10 per 15 minutes | Failed requests only; reset after a successful request | `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MINUTES`     |
  | `forgot` | `POST /auth/password/forgot`                     | 3 per 60 minutes  | Every request                                          | `FORGOT_RATE_LIMIT_MAX`, `FORGOT_RATE_LIMIT_WINDOW_MINUTES` |

  A blocked request answers `429 RATE_LIMITED` with `Retry-After` and writes a `RATE_LIMITED` security event. `POST /auth/refresh` and the logout routes are not limited, so that a renewal is never counted as a login attempt. The client IP is read through `TRUST_PROXY`, and the limits are disabled with `RATE_LIMIT_ENABLED=false` (default in `NODE_ENV=test`, and in `test-flows/.env.flows` for the httpyac flows). The per-IP limit complements the progressive per-account lockout of ADR 0022, which is stored in the database and survives restarts.
