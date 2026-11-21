# UC1 - Check Activation Link

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /auth/activation/inspect` with body `{ "token" }` |
| Allowed roles | Public (Guest): the account is not active yet |
| Success response | 200 OK `{ "method": "local" \| "external", "provider"?, "email": "<masked>", "expiresAt": "<ISO date>" }` |
| Error handling | 400 `VALIDATION_FAILED` (malformed token, value never echoed), 400 `INVITATION_INVALID` (unknown, used, replaced or expired link, or account not waiting for activation), 429 `RATE_LIMITED` |
| ADRs | [ADR-0041](../../adr/0041-administrator-role-role-change-records-and-activation-invitations.md), [ADR-0042](../../adr/0042-account-activation-method-session-and-oidc-transaction.md) |

## Description

The invited user opens the link of the invitation e-mail, `{APP_BASE_URL}/activate#token=...`. `ActivateAccountPage` reads the token from the fragment once (`readActivationToken`: 43 characters in base64url, otherwise the page shows "invalid link" without calling the API) and replaces the address with `/activate`, so the token does not stay in the address bar nor in the history. It then asks the back end which step to show, with `authApi.inspectActivation(token, signal)` (`feedback: 'silent'`: the page explains the errors itself).

The Back-end API:

1. **Route:** `noStore`, the `activation` rate limiter (only failed requests count) and Joi `{ token }` (`400 VALIDATION_FAILED`; Joi messages never contain the value).
2. **Lookup:** `AccountActivationService.inspect` hashes the token (`tokenService.hashOpaqueToken`, SHA-256) and reads the invitation by its hash (`findByTokenHash`; nothing is used) and its account (`usersRepository.findById`).
3. **Rules:** `evaluateAccountActivation` checks that the invitation is usable (known, not used, not replaced, not expired), that the account exists, is `inactive` and was never activated, and that it still has the e-mail of the invitation. A refusal is logged with its reason (`ACCOUNT_ACTIVATION_FAILED`) and answered with the generic `400 INVITATION_INVALID`.
4. **Method:** `externalIdentitiesRepository.findByUserId` and `activationMethodFor`: `external` with the provider of the linked identity, otherwise `local`.
5. **Answer:** 200 with the method, the provider (external only), the masked e-mail (`maskEmail`, for example `m***a@laprizza.pt`) and the expiry. The invitation stays valid.

`activationStep` turns the answer into the step to show: the password form ([UC2](./activate-local-account.md)), the "Continue with <provider>" button ([UC3](./activate-external-account.md)), or "invalid link" for any other answer, so the page never offers a step the back end did not ask for. `INVITATION_INVALID` and `VALIDATION_FAILED` show "This activation link is invalid, was already used, was replaced or has expired"; a network failure or `429` shows the translated error and a "Try again" button.

## Diagram

```mermaid
---
title: "UC1 - Check Activation Link - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Invited User<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as ActivateAccountPage<br/>[Component: React page]
        participant model as account-activation<br/>[Component: JavaScript module]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Rate limit)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AccountActivationService<br/>[Component: Service]
        participant rules as Activation rules<br/>[Component: Domain, pure functions]
        participant invitations as ActivationInvitationsRepository<br/>[Component: Repository, MongoDB]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant identities as ExternalIdentitiesRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>page: Opens /activate#token=... (link of the invitation e-mail)
    activate page
    page->>model: readActivationToken(location.hash)
    model-->>page: token, or null when missing or malformed
    page->>page: navigate("/activate", replace) (token removed from the address)
    alt No valid token
        page-->>user: "This activation link is invalid..."
    else Token read
        page->>route: POST /auth/activation/inspect { token }
        activate route
        route->>route: noStore, activation rate limiter, Joi { token }
        route->>controller: inspectActivation(req, res, next)
        activate controller
        controller->>service: inspect({ token }, { ip, userAgent })
        activate service
        service->>service: tokenHash = SHA-256(token)
        service->>invitations: findByTokenHash(tokenHash)
        activate invitations
        invitations-->>service: invitation or null (not used)
        deactivate invitations
        opt Invitation found
            service->>users: findById(invitation.userId)
            activate users
            users-->>service: user or null
            deactivate users
        end
        service->>rules: evaluateAccountActivation({ invitation, user, now })
        activate rules
        rules-->>service: allowed, or the reason of the refusal
        deactivate rules
        alt Refused (unknown, used, replaced, expired, account not pending, e-mail changed)
            service->>service: securityLogger.log(ACCOUNT_ACTIVATION_FAILED, { ip, reason, userId? })
            service-->>controller: AppError 400 INVITATION_INVALID
            controller-->>page: 400 { error: { code: "INVITATION_INVALID" } }
            page-->>user: "This activation link is invalid..."
        else Allowed
            service->>identities: findByUserId(user._id)
            activate identities
            identities-->>service: linked external identities
            deactivate identities
            service->>rules: activationMethodFor(identities), maskEmail(user.email)
            rules-->>service: { method, provider? }, masked e-mail
            service-->>controller: { method, provider?, email, expiresAt }
            deactivate service
            controller-->>page: 200 OK
            deactivate controller
            deactivate route
            page->>model: activationStep(inspection)
            model-->>page: local, external or invalid
            page-->>user: Password form (UC2) or "Continue with <provider>" (UC3)
        end
    end
    deactivate page
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
