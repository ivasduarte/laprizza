# Implement Refresh Tokens for Secure Sessions

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Extend user sessions securely without issuing long-lived access tokens.

## Context and Problem Statement

Authentication JWTs currently have a 1-hour expiration. Users need to stay logged in without compromising API security, which would happen if access tokens were given extended lifespans.

## Decision Drivers

* Security, user experience, and stateless API compliance.

## Considered Options

* Long-lived JWTs
* Server-side Session Cookies
* Access Token + Refresh Token (HttpOnly Cookie)

## Decision Outcome

Chosen option: "Access Token + Refresh Token", because it maintains the short-lived access token for fast, stateless authorization while securely storing the refresh token in a database-validated, HttpOnly cookie to prevent XSS theft.

### Positive Consequences

* Users remain logged in seamlessly while the system retains the ability to revoke compromised sessions.

### Negative Consequences

* Requires creating new database schemas for token tracking and specific endpoints to handle token rotation.

## Pros and Cons of the Options

### Long-lived JWTs

Increasing the expiration time of the standard JWT to several days or weeks.

* Good, because it is trivial to implement and requires zero backend changes.
* Bad, because it creates a massive security vulnerability if the token is stolen, as stateless JWTs cannot be easily revoked.

### Server-side Session Cookies

Using stateful session management backed by the server.

* Good, because sessions can be instantly revoked on the server side at any time.
* Bad, because it breaks the stateless nature of the REST API and complicates cross-origin requests.

### Access Token + Refresh Token

Using a short-lived access token in memory alongside a long-lived refresh token stored in a secure cookie.

* Good, because it balances a seamless user experience with strict security boundaries and allows selective session revocation.
* Bad, because it increases backend complexity, requiring a new renewal endpoint and database validation logic.
