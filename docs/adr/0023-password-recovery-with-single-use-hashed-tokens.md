# Password Recovery with Single-Use Hashed Tokens

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Local Authentication

## Context and Problem Statement

AA01 requires a password recovery that is time-limited, single-use and proves control of the account, that never sends or shows a password, and whose answers do not disclose whether an account exists. The recovery link is the only secret the user holds, so it must not leak through URLs, logs, the `Referer` header or the database, and two simultaneous requests must not use the same link twice.

## Decision Drivers

* Proof of control of the account: only the owner of the mailbox can complete it.
* Single use and a short lifetime, safe under concurrent requests.
* Nothing reusable in the database, the logs or the server-side URLs.
* No enumeration: same answer and same response time whether the account exists or not.
* After a recovery, a stolen session must not survive.

## Considered Options

* Token: (A) 256 random bits, opaque, only its SHA-256 stored; (B) a signed JWT with the user id and an expiry; (C) a random token stored in plain text.
* Link: (A) the token in the URL fragment (`#token=`); (B) the token in the query string.
* Answer to the request: (A) always `202` with the same body, the work done after the answer; (B) `404` for an unknown e-mail.
* Effect of a reset: (A) revoke every session of the user; (B) keep the existing sessions.

## Decision Outcome

* **Opaque, hashed token (A).** `crypto.randomBytes(32)` in base64url (43 characters). Only its SHA-256 is stored in `Password Reset Tokens`, with a TTL index on `expiresAt`. A new request deletes the previous unused tokens of the user, so only the latest link works.
* **Fragment (A).** The e-mail link is `{APP_BASE_URL}/reset-password#token=...`. Browsers never send a fragment to a server nor put it in the `Referer`; the SPA reads it and removes it from the address bar at once, and sends it in a JSON body.
* **Same answer (A).** `POST /auth/password/forgot` always answers `202 { code: "PASSWORD_RESET_REQUESTED" }`. The lookup, the token and the e-mail are handled after the answer (`defer`), so its time does not depend on the account. Only **active** accounts receive an e-mail: an inactive account uses its activation invitation and a disabled account cannot recover. Requests are limited per IP ([ADR 0009](./0009-implement-rate-limiting-policies.md)).
* **Lifetime and single use.** 30 minutes (`PASSWORD_RESET_TTL_MINUTES`). `POST /auth/password/reset` checks the password policy and hashes the new password **before** using the link, so a weak password never spends it; then one conditional update (`usedAt: null`, `expiresAt > now`) marks the token used, so concurrent requests cannot both succeed. Every refusal answers `400 RESET_TOKEN_INVALID`.
* **Revoke every session (A).** A reset increments `tokenVersion`, revokes every `Auth Session` of the user and clears the login lockout ([ADR 0022](./0022-local-login-without-account-enumeration-and-with-progressive-lockout.md)).
* **Change of password (authenticated).** `POST /auth/password/change` requires the current password, applies the same policy, keeps the current session and revokes the others ([ADR 0043](./0043-secure-session-handling-in-the-api-and-the-spa.md), D7). A wrong current password answers `400 CURRENT_PASSWORD_INCORRECT`, so the SPA does not mistake it for an expired session.

### Positive Consequences

* A database dump or a log never contains a usable recovery link.
* The token never reaches a server log, a proxy log or another site through the `Referer`.
* The answer of the request is identical for existing, unknown, inactive and disabled accounts.
* Whoever had a session before the recovery (for example, with a stolen password) loses it.

### Negative Consequences

* A user who requests two links must use the most recent one.
* The e-mail is sent after the answer: a delivery failure is only visible in the security log (`PASSWORD_RESET_ERROR`), not to the user.
* A disabled account cannot recover its password through this flow.

## Pros and Cons of the Options

### Opaque token, only its hash stored

* Good, because it can be revoked and used once, and a database leak reveals nothing usable.
* Bad, because it needs a collection and a lookup.

### Signed JWT

* Good, because it needs no storage.
* Bad, because it cannot be marked as used or revoked by a newer request, and it is longer in the link.

### Token stored in plain text

* Good, because it is the simplest.
* Bad, because anybody who reads the database can reset any password.

### Token in the fragment

* Good, because it stays in the browser.
* Bad, because the page needs JavaScript to read it.

### Token in the query string

* Good, because it works without JavaScript.
* Bad, because it ends up in server and proxy logs, in the history and in the `Referer`.

### Always 202, work after the answer

* Good, because neither the body nor the time tells whether the account exists.
* Bad, because the caller cannot know whether an e-mail was sent.

### 404 for an unknown e-mail

* Good, because the user knows that the e-mail is wrong.
* Bad, because it enumerates accounts.

### Revoke every session on reset

* Good, because a compromised session cannot outlive the recovery.
* Bad, because the user is logged out on every device.

### Keep the sessions on reset

* Good, because it is less disruptive.
* Bad, because an attacker who already has a session keeps it.
