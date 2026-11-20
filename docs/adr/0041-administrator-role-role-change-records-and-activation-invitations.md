# Administrator Role, Role Change Records and Activation Invitations

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-20

Technical Story: [AA06] Role Assignment and Activation Invitation

## Context and Problem Statement

Until AA06, user administration was provisionally granted to `MANAGER`, local accounts were created active with a password chosen by the Manager, and role changes left no trace beyond the security log. Table 1 gives user administration to an `Administrator` role that grants no restaurant management, and AA06 requires that role changes record who made them and when, and that every new inactive account receives a unique, expiring, single-use activation invitation.

## Decision Drivers

* Follow Table 1: user administration separated from restaurant management.
* Keep the server as the only authority on roles (AA03, AA05).
* Record every role change with its responsible user or system process and time, in a form the application can show.
* Never store or send a usable secret: tokens are hashed, passwords are never sent by e-mail.
* MongoDB runs standalone in the DEI cloud: no multi-document transactions.

## Considered Options

* Role change records: (A) a separate append-only collection, (B) an array embedded in the user document, (C) only the security log.
* Invitations: (A) a dedicated collection with hashed opaque tokens, (B) signed JWT links without storage.
* Administrator: (A) a new `ADMINISTRATOR` role that takes all user administration from `MANAGER`, (B) a new role while `MANAGER` keeps it.

## Decision Outcome

* `ADMINISTRATOR` role with `users:read`, `users:create`, `users:manage`, `users:invite` and `roles:assign:*` for the four roles. `MANAGER` loses all of them.
* Role changes go to the append-only collection `Role Changes` (`userId`, `role`, `action`, `actor {kind, userId | process}`, `at`), read by `GET /users/{id}/role-history`. Role updates are conditional (`$ne` / `$eq` on the role), so only real changes are recorded.
* Without transactions: an assignment whose record fails is undone (503); a removal is never undone (it would restore a withdrawn permission), and the failure goes to the security log with the actor.
* Invitations go to the collection `Activation Invitations`: SHA-256 of a 256-bit opaque token, intended e-mail, issuer, expiry (TTL index) and `usedAt` / `revokedAt`. Issuing revokes the pending ones; `consume()` is atomic and used by AA07.
* `POST /users` refuses a password and creates the account inactive. An account never activated cannot be enabled by an Administrator (`ACTIVATION_REQUIRED`); `activatedAt` tells activated accounts apart.
* A data migration gives `ADMINISTRATOR` to the first Manager of an existing database; the server refuses to start with a Manager but no Administrator.

### Positive Consequences

* Table 1 is followed and checked by the authorization matrix tests.
* The history of every role is visible in the application, with the responsible actor.
* A leaked database does not expose usable invitation links.

### Negative Consequences

* New local accounts cannot be used until AA07 provides the activation.
* Two more collections, and compensation logic instead of transactions.
* The `.http` flows that created users with a password have to use pre-seeded accounts.

## Pros and Cons of the Options

### Separate collection for role changes

* Good, because it is append-only, does not grow the user document and can be queried by user and date.
* Bad, because it is a second write without a transaction.

### Embedded history

* Good, because the change and its record are one atomic update.
* Bad, because the user document grows without limit and history is mixed with state.

### Security log only

* Good, because it already exists.
* Bad, because the application cannot show it, and logs rotate.

### Signed JWT invitation links

* Good, because nothing is stored.
* Bad, because they cannot be made single-use or replaced without storing state anyway.
