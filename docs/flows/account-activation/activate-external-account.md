# UC3 - Activate External Account

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database, External Identity Provider |
| Endpoints | `POST /auth/external/activate` (form, `application/x-www-form-urlencoded`, field `token`), then `GET /auth/external/{provider}/callback` |
| Allowed roles | Public (Guest): the account is not active yet |
| Success response | 303 to the identity provider; after the sign-in, 302 to `/auth/callback?status=activated` (no session, no refresh cookie) |
| Error handling | Always a redirect to the SPA with a public code: `INVITATION_INVALID` (malformed, unknown, used, replaced or expired link, or local account), `INVITATION_MISMATCH` (another identity), `ACCESS_DENIED` (cancelled at the provider), `AUTH_FAILED` (origin not allowed, provider disabled, failed code exchange, missing or tampered transaction) |
| ADRs | [ADR-0051](../../adr/0051-administrator-role-role-change-records-and-activation-invitations.md), [ADR-0052](../../adr/0052-account-activation-method-session-and-oidc-transaction.md) |

## Description

Since 2026-11-21 the first external login creates the account **active** (AA02 clarification), and a successful login at the linked provider also activates an account still waiting for activation (`activateIfPending` in `ExternalAuthService`). This flow therefore only concerns external accounts created inactive before that change that still hold a valid invitation; it is kept so those links keep working. After [UC1](./inspect-activation-link.md) answered `method: "external"`, `ExternalActivation` shows "The account <masked e-mail> signs in with <provider>. Continue with the <provider> account this invitation was sent to, to confirm it is you." and the "Continue with <provider>" button.

**Step 1 - start (`POST /auth/external/activate`).** The button calls `authApi.startExternalActivation(token)`, which builds a hidden form (`externalActivationForm`, `submitForm`) and submits it as a top-level POST. The token travels in the body, never in a URL, and the answer can set a cookie and redirect like the AA02 login. The button is disabled after the first click. The Back-end API:

1. `express.urlencoded` (1 kB). `ExternalAuthController.activate` refuses an `Origin` that is not in `CORS_ORIGIN` (`AUTH_FAILED`) and a token that is not 43 base64url characters (`INVITATION_INVALID`), both as a `303` to the SPA.
2. `ExternalAuthService.startActivation` calls `AccountActivationService.prepareExternal`: the same lookup and rules as UC1, and the account must have a linked identity (`METHOD_MISMATCH` otherwise). It returns the provider of that identity and the hash of the token.
3. `OidcClient.createAuthorizationRequest(provider)` creates state, nonce and the PKCE verifier. The transaction is marked `purpose: "activation"` and keeps `invitationHash`, never the token.
4. The controller signs the transaction (`TransactionCodec`, HMAC-SHA256) into the `lp_oidc` cookie (httpOnly, `SameSite=Lax`, path `/api/v2/auth/external`, 10 min) and answers `303` to the authorization endpoint of the provider.

**Step 2 - callback (`GET /auth/external/{provider}/callback`).** After the sign-in, the provider redirects the browser to the callback, as in AA02:

1. The controller reads and clears the transaction cookie (single use). A cancelled sign-in, a missing or tampered transaction, or another provider answers with an error code.
2. `ExternalAuthService.completeLogin` exchanges the code (`OidcClient.completeAuthorization`, id_token validated: signature, issuer, audience, expiry, nonce) and builds the identity (`provider`, `issuer`, `subject`). A failure is `AUTH_FAILED` and nothing is activated.
3. Because the transaction is an activation, `completeLogin` calls `AccountActivationService.completeExternal` **before** the normal login logic and returns `ACTIVATED`: it never creates an account and never opens a session.
4. `completeExternal` checks the invitation and account again (`loadPending` with `invitationHash`; it may have expired or been replaced while the user was at the provider). `isInvitedIdentity` then compares the authenticated issuer and subject with the identity linked to the account. Another identity is logged (`IDENTITY_MISMATCH`) and answered `403 INVITATION_MISMATCH`; the invitation is not used and the account stays inactive.
5. With the intended identity: `consume(invitationHash, now)`, then `activateAccount(userId, { activatedAt: now })` (no password), both conditional, and `ACCOUNT_ACTIVATED` (`method: "external"`).
6. The controller redirects to `/auth/callback?status=activated` without setting the refresh cookie; errors redirect to `/auth/callback?status=error&code=<public code>`.

`AuthCallbackPage` reads the result with `parseCallbackParams` (unknown values become `AUTH_FAILED`) and shows "Your account is active. Log in to continue." or the translated error. The user then signs in with "Continue with <provider>" (AA02), which opens the session with the roles assigned to the account.

## Diagram

```mermaid
---
title: "UC3 - Activate External Account - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Invited User<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as ExternalActivation<br/>[Component: React component]
        participant model as account-activation / authApi<br/>[Component: JavaScript modules]
        participant callbackPage as AuthCallbackPage<br/>[Component: React page]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant controller as ExternalAuthController<br/>[Component: Controller]
        participant external as ExternalAuthService<br/>[Component: Service]
        participant activation as AccountActivationService<br/>[Component: Service]
        participant oidc as OidcClient<br/>[Component: openid-client]
        participant repos as Invitations / Users / ExternalIdentities<br/>[Component: Repositories, MongoDB]
    end
    box rgba(160,160,160,0.15) External System
        participant idp as External Identity Provider<br/>[External System: OpenID Connect]
    end

    Note over user,page: UC1 answered method "external" with the linked provider
    activate user
    user->>page: Presses "Continue with <provider>"
    activate page
    page->>model: externalActivationForm(apiBaseUrl, token), submitForm
    model->>controller: POST /auth/external/activate (form body token=...)
    deactivate page
    activate controller
    controller->>controller: Origin in CORS_ORIGIN? token format?
    controller->>external: startActivation({ token })
    activate external
    external->>activation: prepareExternal({ token })
    activate activation
    activation->>repos: findByTokenHash, findById, findByUserId
    repos-->>activation: invitation, user, linked identity
    activation->>activation: evaluateAccountActivation, method must be "external"
    activation-->>external: { provider, invitationHash }
    deactivate activation
    external->>oidc: createAuthorizationRequest(provider)
    oidc-->>external: authorizationUrl, { state, nonce, codeVerifier }
    external-->>controller: transaction + { purpose: "activation", invitationHash }
    deactivate external
    controller-->>user: 303 to the provider, Set-Cookie lp_oidc (signed, httpOnly, Lax)
    deactivate controller

    user->>idp: Signs in
    activate idp
    idp-->>user: 302 to /auth/external/{provider}/callback?code&state
    deactivate idp

    user->>controller: GET /auth/external/{provider}/callback (cookie lp_oidc)
    activate controller
    controller->>controller: verify and clear the transaction cookie (single use)
    controller->>external: completeLogin({ providerName, callbackUrl, transaction })
    activate external
    external->>oidc: completeAuthorization (code exchange, id_token checks)
    activate oidc
    oidc->>idp: Token request (code + PKCE verifier)
    idp-->>oidc: id_token
    oidc-->>external: validated claims (iss, sub, email)
    deactivate oidc
    external->>external: identity = { provider, issuer, subject }
    Note right of external: purpose "activation": no account creation, no session
    external->>activation: completeExternal({ invitationHash, identity })
    activate activation
    activation->>repos: findByTokenHash, findById, findByUserId
    repos-->>activation: invitation, user, linked identities
    alt Invitation no longer usable or account not pending
        activation-->>external: AppError 400 INVITATION_INVALID
    else Another identity (issuer or subject differ)
        activation->>activation: securityLogger.log(ACCOUNT_ACTIVATION_FAILED, IDENTITY_MISMATCH)
        activation-->>external: AppError 403 INVITATION_MISMATCH (link not used, account inactive)
    else Intended identity
        activation->>repos: consume(invitationHash, now)
        activation->>repos: activateAccount(userId, { activatedAt: now })
        activation->>activation: securityLogger.log(ACCOUNT_ACTIVATED, method "external")
        activation-->>external: done
    end
    deactivate activation
    external-->>controller: { outcome: "ACTIVATED" } or the error
    deactivate external
    alt Activated
        controller-->>user: 302 /auth/callback?status=activated (no refresh cookie)
    else Error
        controller-->>user: 302 /auth/callback?status=error&code=<public code>
    end
    deactivate controller
    user->>callbackPage: Opens /auth/callback
    activate callbackPage
    callbackPage->>callbackPage: parseCallbackParams
    callbackPage-->>user: "Your account is active. Log in to continue." or the translated error
    deactivate callbackPage
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
