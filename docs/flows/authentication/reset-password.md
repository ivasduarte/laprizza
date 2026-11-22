# UC4 - Reset Password (AA01)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /auth/password/reset` with body `{ "token", "newPassword" }` |
| Allowed roles | Public (Guest): the link proves control of the account |
| Success response | 204 No Content (no session opened, refresh cookie cleared) |
| Error handling | 400 `VALIDATION_FAILED` (malformed token, the value is never echoed), 400 `PASSWORD_POLICY_VIOLATION` (checked before the link is used), 400 `RESET_TOKEN_INVALID` (unknown, used, replaced or expired link, or account no longer active) |
| ADRs | [ADR-0023](../../adr/0023-password-recovery-with-single-use-hashed-tokens.md), [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md) |

## Description

The user opens the link of the recovery e-mail (UC3). `ResetPasswordPage` reads the token from the fragment and immediately replaces the address with `/reset-password`, so the token stays neither in the address bar nor in the history. Without a token the page shows "Invalid recovery link". The page shows the password rules; the user types the new password and its confirmation, which the form checks with the AA01 rules (`passwordRules()`, same as confirmation) before sending.

The Back-end API:

1. **Route:** `noStore` and Joi: `token` must be 43 base64url characters, `newPassword` at most 256 characters.
2. **Password first:** `assertPasswordPolicy` (8 to 64 characters, one uppercase letter, one of `! @ # $ % ^ & * . , - _ ?`) and `passwordHasher.hash` (Argon2id), before the link is touched, so a weak password never spends it.
3. **Use the link:** `consume(SHA-256(token), now)` is one conditional update (`usedAt: null`, `expiresAt > now`) that sets `usedAt`, so two concurrent requests cannot both use it.
4. **Account:** the account must still exist and be `active`. Otherwise, or if the link was unknown, used, replaced or expired, `PASSWORD_RESET_FAILED` is logged with the reason and the answer is `400 RESET_TOKEN_INVALID`.
5. **Replace the password:** `setPasswordHash(..., { revokeTokens: true })` stores the new hash, clears the login wait and increments `tokenVersion`, and every `Auth Session` of the user is revoked. `PASSWORD_RESET_COMPLETED` is logged.
6. **Answer:** `204`, with the refresh cookie cleared. No session is opened.

The page shows "Password changed. You can now log in with the new password." and a link to the login (UC1).

## Diagram

```mermaid
---
title: "UC4 - Reset Password (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant hasher as PasswordHasher<br/>[Component: Argon2id]
        participant tokens as PasswordResetTokensRepository<br/>[Component: Repository, MongoDB]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant sessions as AuthSessionsRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Opens the link of the e-mail (/reset-password with the token in the fragment)
    activate spa
    spa->>spa: Reads the token from the fragment, replaces the address with /reset-password
    user->>spa: Types the new password and its confirmation, presses "Save password"
    spa->>spa: Checks the AA01 password rules and the confirmation
    spa->>route: POST /auth/password/reset { token, newPassword }
    activate route
    route->>route: noStore, Joi (token of 43 base64url characters, newPassword)
    route->>controller: resetPassword(req, res, next)
    activate controller
    controller->>service: resetPassword({ token, newPassword }, { ip })
    activate service
    service->>service: assertPasswordPolicy(newPassword)
    Note right of service: A weak password answers 400 PASSWORD_POLICY_VIOLATION before the link is used
    service->>hasher: hash(newPassword)
    hasher-->>service: Argon2id hash
    service->>tokens: consume(SHA-256(token), now)
    Note right of tokens: Only if usedAt is null and expiresAt is in the future (single use, atomic)
    tokens-->>service: used token, or null
    service->>users: findById(token.userId)
    users-->>service: user, or null
    alt Unknown, used, replaced or expired link, or account not active
        service->>service: securityLogger.log(PASSWORD_RESET_FAILED, reason)
        service-->>controller: AppError 400 RESET_TOKEN_INVALID
        controller-->>spa: 400
        spa-->>user: "The recovery link is invalid, was already used or has expired."
    else Valid link and active account
        service->>users: setPasswordHash(userId, hash, revokeTokens)
        Note right of users: tokenVersion incremented, login wait cleared
        users-->>service: done
        service->>sessions: revokeAllForUser(userId, now)
        sessions-->>service: done
        service->>service: securityLogger.log(PASSWORD_RESET_COMPLETED)
        service-->>controller: done
        controller-->>spa: 204, refresh cookie cleared, no session
        spa-->>user: "Password changed. You can now log in with the new password."
    end
    deactivate service
    deactivate controller
    deactivate route
    deactivate spa
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
