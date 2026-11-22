# Authentication and Authorization

* Status: accepted, amended (see Amendments)
* Deciders: Development Team
* Date: 2026-09-26

## Context and Problem Statement

LaPrizza requires user and role management to protect operations and identify authorized users, and customer data must be handled securely under GDPR. A secure password hashing algorithm and a stateless session mechanism are required.

## Considered Options

* Argon2 with JWT
* Bcrypt with JWT
* PBKDF2 with JWT
* Scrypt with JWT

## Decision Outcome

Chosen option: "Argon2 with JWT", because Argon2 balances CPU and memory hardness (PHC winner), making it highly resistant to GPU/ASIC attacks, while JSON Web Tokens (JWT) with embedded roles provide stateless and performant authorization.

## Pros and Cons of the Options

### Argon2 with JWT

* Good, because Argon2 provides modern resistance against GPU/ASIC attacks, and embedding roles in the JWT keeps the API stateless and performant.
* Bad, because if token revocation becomes necessary before the 1-hour expiration, a token blacklist or refresh token strategy must be implemented.

### Bcrypt with JWT

* Good, because it is widely adopted and extensively tested.
* Bad, because it relies solely on CPU cost, making it increasingly vulnerable to brute-force attacks using modern GPUs or ASICs,

### PBKDF2 with JWT

* Good, because it is NIST-approved and easy to implement.
* Bad, because it lacks memory-hardness, making it highly susceptible to custom hardware attacks.

### Scrypt with JWT

* Good, because it introduces memory-hardness and performs better than Bcrypt against ASICs.
* Bad, because it has been essentially superseded by Argon2.

## Amendments

* AA01 ([ADR 0043](0043-local-login-without-account-enumeration-and-with-progressive-lockout.md), [ADR 0044](0044-password-recovery-with-single-use-hashed-tokens.md), [ADR 0045](0045-e-mail-delivery-with-nodemailer-and-mailpit.md)): users log in with their normalized e-mail, no longer with a username. Passwords use Argon2id with pinned parameters (64 MiB, 3 iterations, 4 lanes); a hash created with other parameters is replaced at the next successful login (`needsRehash`). Accounts have a `status` (`inactive`, `active`, `disabled`) instead of `isActive`, and only `active` accounts open a session. The 1-hour stateless token is replaced by the access and refresh token model of [ADR 0011](0011-implement-refresh-tokens-for-secure-sessions.md). Password recovery uses a single-use, hashed token sent by e-mail.
* AA04 ([ADR 0032](0032-secure-session-handling-in-the-api-and-the-spa.md)): the access token is short-lived and backed by a server-side session with a rotating refresh token, so sessions can be revoked before the token expires.
* AA03 ([Role Resolution](../flows/authentication/role-resolution.md)): roles are no longer embedded in the JWT. They are internal to LaPrizza, read from the database on every login, refresh and protected request, and never taken from the token, the client or an external identity provider. Every new account starts with the role `CUSTOMER`. The statements above about "JWT with embedded roles" describe the original decision and are superseded on this point.
* AA05 ([ADR 0046](0046-permission-based-authorization-matrix.md)): authorization is by permission, not by role. Routes check permissions from a single role → permission matrix, computed on every request from the roles in the database; a request without a session has only the Guest permissions. A missing or invalid session answers 401 and a lack of permission answers 403.
* AA06 ([ADR 0041](0041-administrator-role-role-change-records-and-activation-invitations.md)): user administration belongs to the new `ADMINISTRATOR` role, no longer to the Manager. Accounts created by an Administrator are inactive, have no password and are activated with a single-use invitation (AA07); every role assignment and removal is recorded with its actor and time.
