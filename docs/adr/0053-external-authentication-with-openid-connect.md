# External Authentication with OpenID Connect

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-21 (records the decisions taken when AA02 was implemented; previously cited as "ADR 0033", a number already used; renumbered from 0044, a number already used)

Technical Story: [AA02] External Identity Provider Integration

## Context and Problem Statement

AA02 asks for sign-in through an external identity provider with OpenID Connect and OAuth 2.0, returning to the application after the provider, without the application collecting the provider password, and with the same session as the local login (AA04). How should the flow run between the SPA, the back end and the provider?

## Decision Drivers

* No provider secret, ID token or access token in the browser or in a URL.
* One kind of session for local and external logins.
* Providers are configuration; a missing one must not break the local login.

## Considered Options

* (A) Authorization Code flow with PKCE, the back end as a confidential client (`openid-client`).
* (B) Authorization Code with PKCE in the SPA (public client), the SPA sends the ID token to the back end.
* (C) Implicit flow.

## Decision Outcome

Chosen option: **(A)**.

| # | Decision |
|:--|:---------|
| D1 | `GET /auth/external/{provider}/login` creates `state`, `nonce` and `code_verifier`, keeps them in the signed `HttpOnly` cookie `lp_oidc` (`SameSite=Lax`, 10 minutes) and redirects to the provider. |
| D2 | `GET /auth/external/{provider}/callback` exchanges the code with `openid-client`, which validates the ID token (`iss`, `aud`, `exp`, `nonce`), and calls the same `establishSession` as the local login. The SPA receives only a redirect with `status` and a closed list of codes; the session is restored with the refresh cookie. |
| D3 | Providers (Google, Microsoft) are enabled only when their client id and secret are set; `API_PUBLIC_URL` must be HTTPS outside `localhost`. The redirect URI uses the current API version. |
| D4 | Microsoft tenants `common` and `organizations` are refused (their issuer cannot be validated). |

### Positive Consequences

* Secrets and tokens stay on the server; the browser only sees cookies and codes.
* Local and external users share session handling, authorization and logout.

### Negative Consequences

* The back end keeps per-login state in a cookie (`lp_oidc`) and needs HTTPS in production.
* Provider logout is not performed (out of scope).

## Links

* [External Authentication (AA02)](../flows/authentication/external-authentication.md)
* [ADR 0054 - External identity model and account resolution](./0054-external-identity-model-and-account-resolution.md)
* [ADR 0032 - Secure session handling](./0032-secure-session-handling-in-the-api-and-the-spa.md)
