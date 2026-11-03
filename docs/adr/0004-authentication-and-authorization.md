# Authentication and Authorization

* Status: accepted
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
