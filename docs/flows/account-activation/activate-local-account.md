# UC2 - Activate Local Account

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /auth/activation/local` with body `{ "token", "newPassword" }` |
| Allowed roles | Public (Guest): the account is not active yet |
| Success response | 204 No Content (no session, no cookie) |
| Error handling | 400 `VALIDATION_FAILED`, 400 `PASSWORD_POLICY_VIOLATION` (checked before the link is used), 400 `INVITATION_INVALID` (invalid, used, replaced or expired link, account not waiting for activation, or account that must be activated at its identity provider), 429 `RATE_LIMITED` |
| ADRs | [ADR-0041](../../adr/0041-administrator-role-role-change-records-and-activation-invitations.md), [ADR-0042](../../adr/0042-account-activation-method-session-and-oidc-transaction.md) |

## Description

After [UC1](./inspect-activation-link.md) answered `method: "local"` (an account created by an Administrator), `LocalActivation` shows "Choose the password of the account <masked e-mail>", the password rules and the note that activating the account does not subscribe to marketing communications. The user types the password and its confirmation. The form checks them with the AA01 rules (`passwordRules()`, `sameAs('newPassword')`) before sending, and `useSubmit` allows one request at a time. The typed values are kept after an error.

The Back-end API:

1. **Route:** `noStore`, the `activation` rate limiter and Joi `{ token, newPassword }`.
2. **Password first:** `assertPasswordPolicy(newPassword)` (`400 PASSWORD_POLICY_VIOLATION`) and `passwordHasher.hash` (Argon2id), before the invitation is read, so a weak password never spends the link.
3. **Checks:** the same lookup and rules as [UC1](./inspect-activation-link.md) (`loadPending`). An account with a linked external identity is refused (`METHOD_MISMATCH` in the log, `400 INVITATION_INVALID` in the answer).
4. **Use the invitation:** `invitationsRepository.consume(tokenHash, now)`, one conditional update (`usedAt: null`, `revokedAt: null`, `expiresAt > now`). `null` means that another request used or replaced it in the meantime: `400 INVITATION_INVALID`.
5. **Activate:** `usersRepository.activateAccount(userId, { activatedAt: now, passwordHash })`, a conditional update on `status: "inactive", activatedAt: null` that sets only `status: "active"`, `activatedAt`, `failedLoginCount: 0`, `lockedUntil: null` and `passwordHash`. Roles and every other field stay as they are. `null` means that the account was disabled in the meantime: the link is spent and the account stays disabled (`ACCOUNT_NOT_PENDING` in the log, `400 INVITATION_INVALID`).
6. **Log and answer:** `ACCOUNT_ACTIVATED` (`userId`, `method: "local"`, `ip`) and `204`. No session is created and no cookie is set.

The page shows "Your account is active. Log in to continue." and a link to the login. The user then signs in with the normal login (AA01), which loads the roles assigned by AA06 (AA03).

## Diagram

```mermaid
---
title: "UC2 - Activate Local Account - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Invited User<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant form as LocalActivation<br/>[Component: React form]
        participant api as authApi<br/>[Component: JavaScript module]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Rate limit)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AccountActivationService<br/>[Component: Service]
        participant rules as Activation rules<br/>[Component: Domain, pure functions]
        participant invitations as ActivationInvitationsRepository<br/>[Component: Repository, MongoDB]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
    end

    Note over user,form: UC1 answered method "local"
    activate user
    user->>form: Types the password and its confirmation, presses "Activate account"
    activate form
    form->>form: validateForm (AA01 password rules, confirmation), one submission at a time
    form->>api: activateLocal(token, newPassword)
    activate api
    api->>route: POST /auth/activation/local { token, newPassword }
    activate route
    route->>route: noStore, activation rate limiter, Joi { token, newPassword }
    route->>controller: activateLocal(req, res, next)
    activate controller
    controller->>service: activateLocal({ token, newPassword }, { ip, userAgent })
    activate service
    service->>service: assertPasswordPolicy(newPassword), passwordHasher.hash (Argon2id)
    Note right of service: A weak password answers 400 PASSWORD_POLICY_VIOLATION before the link is used
    service->>invitations: findByTokenHash(SHA-256(token))
    activate invitations
    invitations-->>service: invitation
    deactivate invitations
    service->>users: findById(invitation.userId)
    activate users
    users-->>service: user
    deactivate users
    service->>rules: evaluateAccountActivation, activationMethodFor
    activate rules
    rules-->>service: allowed and method "local", or the reason of the refusal
    deactivate rules
    alt Refused (invalid link, account not pending, external account)
        service-->>controller: AppError 400 INVITATION_INVALID (reason in the security log)
        controller-->>api: 400
        api-->>form: error
        form-->>user: Translated error, typed values kept
    else Allowed
        service->>invitations: consume(tokenHash, now)
        activate invitations
        invitations-->>service: used invitation, or null if used or replaced concurrently
        deactivate invitations
        service->>users: activateAccount(userId, { activatedAt: now, passwordHash })
        activate users
        Note right of users: Only if status "inactive" and activatedAt null, roles unchanged
        users-->>service: active user, or null if disabled meanwhile
        deactivate users
        service->>service: securityLogger.log(ACCOUNT_ACTIVATED, { userId, method: "local", ip })
        service-->>controller: done
        deactivate service
        controller-->>api: 204 No Content (no session, no cookie)
        deactivate controller
        deactivate route
        api-->>form: ok
        deactivate api
        form-->>user: "Your account is active. Log in to continue."
    end
    deactivate form
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
