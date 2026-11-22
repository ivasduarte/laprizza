# External Identity Model and Account Resolution

* Status: accepted (revised 2026-11-21 by the AA02/AA07 clarification)
* Deciders: Development Team
* Date: 2026-11-21 (records the decisions taken when AA02 was implemented; previously cited as "ADR 0034", a number already used; renumbered from 0045, a number already used)

Technical Story: [AA02] External Identity Provider Integration, [AA03] Internal Role Resolution

## Context and Problem Statement

After a valid ID token, the back end must decide which internal account the identity belongs to, without duplicate accounts and without letting a provider take over an existing account. The client clarified that the first external login creates an active account, that an existing e-mail must not be linked automatically, and that a missing phone is asked before the customer features.

## Decision Drivers

* No duplicate accounts; no account takeover through an e-mail claimed by a provider.
* Roles always internal (AA03): never taken from the provider.
* The verified provider identity validates the account (AA07 clarification).

## Considered Options

* Identity key: (A) `(issuer, sub)` in a separate `External Identities` collection, (B) the e-mail.
* Unknown identity whose e-mail already has an account: (A) refuse (`ACCOUNT_LINK_REQUIRED`), (B) link automatically.
* New account: (A) active with a session, (B) inactive with an activation invitation.

## Decision Outcome

* **`(issuer, sub)` (A).** The e-mail can change at the provider; issuer and subject cannot. The pair is unique.
* **Refuse (A).** Linking only by e-mail would let a provider that claims someone's e-mail sign in to that account. Linking an existing account requires a mechanism already bound to it (proposed: from the account page, after re-entering the local password).
* **Active with a session (A), revised 2026-11-21.** A verified e-mail that no account uses creates an `active` account with `CUSTOMER` only and opens the session. If the identity link fails, the new account is deleted (no transactions on the standalone MongoDB). A linked account still waiting for activation is activated by its next external login; disabled or deactivated accounts are never reactivated.
* **Contact phone.** While a `CUSTOMER` has neither a phone nor a Customer record, `phoneRequired` is true and `CUSTOMER_CONTACT_PERMISSIONS` are withheld until `PUT /auth/me/phone`.

### Consequences

* An existing local user cannot use a provider until account linking is implemented.
* Customer features need one extra step after the first external login.

## Links

* [External Authentication (AA02)](../flows/authentication/external-authentication.md)
* [ADR 0042 - Account activation](./0042-account-activation-method-session-and-oidc-transaction.md)
