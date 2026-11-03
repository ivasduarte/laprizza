# Secrets Management Strategy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Securely manage and inject application secrets to prevent credential leakage in production.

## Context and Problem Statement

Sensitive configuration (database credentials, JWT secrets) must be managed securely. Relying on .env files deployed to servers or committed to repositories poses a severe security risk.

## Decision Drivers

* Security, auditability, and CI/CD compatibility.

## Considered Options

* Server-side .env files
* OS Environment Variables
* External Secrets Manager

## Decision Outcome

Chosen option: "External Secrets Manager", because secrets will be dynamically injected into the runtime environment by the deployment pipeline, ensuring the codebase accesses them strictly via process.env without relying on physical files on disk.

### Positive Consequences

* Eliminates the risk of credential leakage via file system access and provides a centralized, auditable location for rotating secrets.

### Negative Consequences

* Increases deployment pipeline complexity and introduces a dependency on the secrets manager's uptime during application scaling or restarts.

## Pros and Cons of the Options

### Server-side .env files

Manually placing .env files on production servers

* Good, because it mirrors the local development workflow perfectly.
* Bad, because if the server's file system is compromised, all credentials are immediately exposed in plain text.

### OS Environment Variables

Setting variables directly in the host server's operating system.

* Good, because variables reside in memory rather than in static project files.
* Bad, because managing these across a fleet of servers is manual and prone to configuration drift.

### External Secrets Manager

Using a dedicated vault (e.g., AWS Secrets Manager, GitHub Secrets, HashiCorp Vault).

* Good, because secrets are encrypted at rest, tightly access-controlled, and injected dynamically only at runtime or deploy time.
* Bad, because it requires integrating external APIs into the CI/CD pipeline and application startup process.
