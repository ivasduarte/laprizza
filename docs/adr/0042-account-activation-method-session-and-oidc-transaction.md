# Account Activation: Method from the Linked Identity, No Session and a Marked OIDC Transaction

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-21

Technical Story: [AA07] Secure Account Activation

## Context and Problem Statement

AA06 creates inactive accounts and sends each one a unique, expiring, single-use activation invitation; only the hash of its token is stored. AA07 must let the intended recipient complete the activation: a local account by setting its own password, an external account by signing in at the identity provider, and only if the authenticated identity is the intended one. Activation must not need a session, must not give access to protected functionality, must enable only the roles already assigned and must not grant the optional marketing consent. MongoDB runs standalone in the DEI cloud, so there are no multi-document transactions.

## Decision Drivers

* Enable the account only for the intended identity.
* Keep the token out of URLs, server logs and cookies.
* Do not reveal whether a link or an account exists.
* Activation is not authentication: no session and no access during the activation.
* Reuse the AA01 password rules and the AA02 OIDC login instead of a second implementation.

## Considered Options

* Activation method: (A) derived from the external identity linked to the account, (B) stored in the invitation by AA06, (C) chosen by the user on the activation page.
* Identity check for an external account: (A) issuer and subject of the linked identity, (B) the verified e-mail returned by the provider.
* After the activation: (A) no session, the user logs in next, (B) open a session immediately.
* Starting the external activation: (A) a form POST with the token in the body and an OIDC transaction marked as an activation, (B) a GET with the token in the query string, (C) an XHR that returns the provider URL.

## Decision Outcome

* **Method from the linked identity (A).** An account with a linked external identity was created by its first external login (AA02) and is activated at that provider; any other account was created by an Administrator and is activated by setting its password. Nothing new is stored and AA06 does not need to know the method. The client cannot choose: the wrong method answers `INVITATION_INVALID`.
* **Issuer and subject (A).** The identity authenticated at the provider must be the one linked to the account. Another identity answers `INVITATION_MISMATCH` and leaves the invitation unused.
* **No session (A).** Both activations answer without a refresh cookie and the user signs in with AA01 or AA02. `activateAccount` only sets status, activation date, login counters and, for a local account, the password hash.
* **Form POST and marked transaction (A).** `POST /auth/external/activate` receives the token in a form body and stores in the signed `lp_oidc` cookie `purpose: "activation"` and the token hash. On the callback, an activation transaction goes to the activation service before the login logic, so it can never create an account or open a session.
* **Without transactions:** the invitation is consumed first (conditional update) and the account activated next (conditional on `inactive` and never activated). Every refusal answers `INVITATION_INVALID` (or `INVITATION_MISMATCH`), and the real reason goes only to the security log.

### Positive Consequences

* A leaked link cannot activate an external account without the intended provider account.
* The token never appears in a URL or in a log; the database and the cookie keep only its hash.
* The same rules (`account-activation.domain.js`) serve the local and the external activation, and are tested without a database.
* The AA02 callback, cookie and code exchange are reused unchanged for the activation.

### Negative Consequences

* An external user signs in at the provider twice: once to activate, once to log in.
* An Administrator cannot invite a user to activate with an external provider: accounts created by an Administrator are local.
* If an Administrator disables the account between the two updates, the link is spent; a new invitation is needed.
* The Web Application must use the current API version (`/api/v2`): the OIDC callback and the refresh cookie are scoped to it.

## Pros and Cons of the Options

### Method from the linked identity

* Good, because nothing new is stored and the method cannot be chosen by whoever holds the link.
* Bad, because accounts created by an Administrator can only be activated locally.

### Method stored in the invitation

* Good, because an Administrator could invite an external user.
* Bad, because AA06 would need to ask for the method and the provider, and the identity still has to be linked during the activation.

### Method chosen by the user

* Good, because it is flexible.
* Bad, because the holder of a link could pick the weaker path.

### Verified e-mail instead of issuer and subject

* Good, because it works for accounts with no linked identity.
* Bad, because an e-mail can change or be reassigned at the provider; AA02 already identifies users by issuer and subject.

### Opening a session after the activation

* Good, because it saves one step.
* Bad, because activation would then grant access, against the acceptance criteria, and the two methods would behave differently.

### Token in the query string or an XHR

* Good, because it is simpler to call.
* Bad, because a query string ends up in server and proxy logs and in the `Referer`; an XHR cannot follow the redirect to the provider in the same navigation.

## Revision 2026-11-21 (AA02/AA07 clarification)

The clarification states that an account linked to an external provider is validated by a successful authentication at that provider, and that the first external login creates an active account. Consequently:

* `ExternalAuthService` creates new external accounts `active` (with `activatedAt`) and opens the session; no invitation is issued for them.
* A linked account still `inactive` and never activated is activated atomically (`activateAccount`) by its next external login, which then opens the session. Accounts deactivated after activation, or disabled, are never reactivated by a login (AA03).
* The external activation of this ADR (marked OIDC transaction, no session) is kept only for those older accounts and their valid invitations. Local accounts are unchanged.
