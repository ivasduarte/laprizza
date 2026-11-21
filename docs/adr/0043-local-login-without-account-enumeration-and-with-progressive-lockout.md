# Local login without Account Enumeration and with Progressive Lockout

* Status : accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Local Authentication

## Context and Problem Statement

AA01 requires a local login with an account identifier and a password. Only active accounts may open a session, failed logins must not disclose whether an account exists, and repeated failures must be controlled to discourage automated guessing. 

The BCK01 login accepted an email or a username, answered every failure with the same generic 401 (including inactive accounts) and had no protection against repeated attempts. This way, an attacker can learn whether an account exists from the error message, the status code, the response time (a password is only verified when the user exists) and from a lockout message that only appears for real accounts.

## Decision Drivers

* No enumeration: the message, the status, the response time and the lockout must look the same for an existing and a non-existing account.
* Slow down online guessing without locking a legitimate user out indefinitely.
* An inactive account must keep its activation path and the user must be told why the login is refused.
* The rules must be pure and testable, and shared with the external login.

## Considered Options

* Identifier: (A) the e-mail only, normalized; (B) e-mail or username.
* Repeated Failures: (A) progressive wait per account, also for unknown e-mails; (B) permanent lock after N failures until an Administrator unlocks it; (C) per-IP rate limit only; (D) CAPTCHA after N failures.
* Account state: (A) revealed only after a correct password (403 with its own code); (B) the same 401 for every failure, as in BCK01.

## Decision Outcome

* **E-mail Only (A):** The e-mail is unique and normalized in the domain and in the unique index. Accounts without an e-mail cannot login; the AA01 migration lists them without changing them.
* **Same answer to every credentials failure:** An unknown account and a wrong password both answer `401 INVALID_CREDENTIALS` with the same body. When the account does not exist, Argon2 verifies the password against a fictitious hash computed once with the same parameters and pre-computed at start-up, so both paths cost the same.
* **Progressive wait (A).** From the 3rd consecutive failure the account waits 1 min, then 5 min, then 30 min for every further failure (`LOGIN_LOCKOUT_THRESHOLD`, `LOGIN_LOCKOUT_STEPS_SECONDS`, the last step repeats). During the wait the login answers `429 TOO_MANY_ATTEMPTS` with `Retry-After`, before the password is checked. The counter and the wait are stored on the user, updated atomically (`$inc`, `$max`), and reset by a correct password or a password reset. Failures of **unknown** e-mails are counted the same way in `Login Throttles`, keyed by the SHA-256 of the normalized e-mail (never the e-mail itself) and removed by a TTL index after 24 h without failures (`LOGIN_THROTTLE_RETENTION_HOURS`). The delay is computed by a pure domain function (`computeLockoutDelayMs`). The per-IP limit of [ADR 0008](./0008-implement-rate-limiting-policies.md) complements it.
* **State after the password (A).** Only when the password is correct does an inactive or disabled account get `403 ACCOUNT_INACTIVE` or `403 ACCOUNT_DISABLED`, with no session. A wrong password on such an account still answers `401 INVALID_CREDENTIALS`, so the state is only revealed to someone who knows the password. The decision is made in the domain and applied in `establishSession`, the function shared with the external login.

### Positive Consequences

* The answer, its time and the lockout do not depend on the account existing.
* Online guessing is limited to a few attempts per hour per account, and per IP by the rate limiter.
* A legitimate user is never locked out for more than 30 minutes and knows why the login is refused.
* The rules (`evaluateAuthentication`, `computeLockoutDelayMs`, `remainingLockoutMs`) are pure functions with unit tests.

### Negative Consequences

* Somebody who knows a user's e-mail can keep that account waiting (up to 30 minutes per attempt). The per-IP rate limiter reduces the impact; an Administrator cannot clear the wait yet.
* The counter of a real account only goes back to zero after a correct login or a reset, while the counter of an unknown e-mail expires after 24 hours.
* Usernames no longer identify a user at login; accounts created before this change, without an e-mail, need one.

## Pros and Cons of the Options

### E-mail only

* Good, because there is one unique, normalized identifier, also used by the password recovery and the invitations.
* Bad, because older accounts, without an e-mail, cannot log in.

### E-mail or username

* Good, because it keeps the past behaviour.
* Bad, because two identifiers double the lookups, the lockout keys and the enumeration surface.

### Progressive wait per account

* Good, because it slows a targeted attack without permanent lockouts or administrator work.
* Bad, because it can be used to annoy a known user.

### Permanent lock until an Administrator unlocks

* Good, because it stops guessing completely.
* Bad, because anybody can lock any account, and it needs a back-office procedure.

### Per-IP rate limit only

* Good, because it is simple and already exists.
* Bad, because a distributed attack uses many IPs, and an office behind one IP is limited as a whole.

### CAPTCHA

* Good, because it targets automation directly.
* Bad, because it needs an external service and adds friction.

### State revealed only after a correct password

* Good, because the user learns why the login is refused, without telling an attacker anything.
* Bad, because the status codes of a failed login differ (401 or 403) depending on the password being right.

### The same 401 for every failure

* Good, because it reveals nothing at all.
* Bad, because an invited or disabled user cannot tell what to do, against AA01 (activation must stay available) and AA03 (access denied message).
