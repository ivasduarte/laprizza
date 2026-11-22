# UC5 - Change Password (AA01)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /auth/password/change` with body `{ "currentPassword", "newPassword" }` |
| Allowed roles | Authenticated (any active account with a valid session) |
| Success response | 204 No Content (the current session is kept) |
| Error handling | 400 `VALIDATION_FAILED`, 400 `CURRENT_PASSWORD_INCORRECT` (the session is not ended), 400 `PASSWORD_POLICY_VIOLATION`, 401 `TOKEN_MISSING`, `TOKEN_INVALID`, `SESSION_REVOKED`, 429 `RATE_LIMITED` (failed attempts per IP, shared with the login) with `Retry-After` |
| ADRs | [ADR-0009](../../adr/0009-implement-rate-limiting-policies.md), [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md), [ADR-0023](../../adr/0023-password-recovery-with-single-use-hashed-tokens.md) |

## Description

The user opens **Change password** in the account menu of the header. The page (`/change-password`, protected by the route guard, not shown in the navigation) shows the e-mail of the signed-in account and the password rules. The user types the current password, the new one and its confirmation, and presses "Change password". The form checks that the current password is filled, the new one follows the AA01 rules (`passwordRules()`) and the confirmation is equal, and allows one request at a time.

The Back-end API:

1. **Route:** `noStore`, the `login` rate limiter (per IP, counts only failed requests, so a stolen session cannot be used to guess the password), `requireAuthenticated` (valid access token, active account, same `tokenVersion`, session not revoked) and Joi `{ currentPassword, newPassword }`, each at most 256 characters.
2. **Current password:** the user is loaded with the password hash (a user that no longer exists answers `401 SESSION_REVOKED`) and the current password is verified with Argon2id. A wrong password logs `PASSWORD_CHANGE_FAILED` (reason `CURRENT_PASSWORD_INCORRECT`) and answers `400 CURRENT_PASSWORD_INCORRECT`; the session is kept, so the user can try again.
3. **New password:** `assertPasswordPolicy` (8 to 64 characters, one uppercase letter, one of `! @ # $ % ^ & * . , - _ ?`), then `passwordHasher.hash` (Argon2id) and `setPasswordHash`.
4. **Sessions:** every other `Auth Session` of the user is revoked (`revokeAllForUser` with `exceptSessionId`). The `tokenVersion` is not incremented, so the current access token and refresh cookie keep working.
5. **Log and answer:** `PASSWORD_CHANGED` (user id, session id, IP, never the passwords) and `204`.

On success the page clears the fields and shows "Password changed. Sessions on other devices were ended."; on failure it keeps the typed values and shows the translated error next to the field. The same page offers **Logout** and **Logout on all devices** ([UC2 - End Sessions](./end-sessions.md)).

## Diagram

```mermaid
---
title: "UC5 - Change Password (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Rate limit, Auth & Joi)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant hasher as PasswordHasher<br/>[Component: Argon2id]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant sessions as AuthSessionsRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Chooses "Change password" in the account menu
    activate spa
    spa-->>user: Page /change-password (session required) with the signed-in e-mail, the password rules and the form
    user->>spa: Types the current password, the new one and its confirmation, presses "Change password"
    spa->>spa: Checks the fields (current required, AA01 password rules, confirmation), one submission at a time
    spa->>route: POST /auth/password/change { currentPassword, newPassword } (Bearer token)
    activate route
    route->>route: noStore, login rate limiter (failures only), requireAuthenticated, Joi
    route->>controller: changePassword(req, res, next)
    activate controller
    controller->>service: changePassword({ userId, sessionId, currentPassword, newPassword }, { ip })
    activate service
    service->>users: findByIdWithPasswordHash(userId)
    users-->>service: user (401 SESSION_REVOKED if it no longer exists)
    service->>hasher: verify(passwordHash, currentPassword)
    hasher-->>service: match or no match
    alt Wrong current password
        service->>service: securityLogger.log(PASSWORD_CHANGE_FAILED, CURRENT_PASSWORD_INCORRECT)
        service-->>controller: AppError 400 CURRENT_PASSWORD_INCORRECT
        controller-->>spa: 400, the session is kept
        spa-->>user: Translated error next to the field, typed values kept
    else Correct current password
        service->>service: assertPasswordPolicy(newPassword)
        Note right of service: A weak password answers 400 PASSWORD_POLICY_VIOLATION
        service->>hasher: hash(newPassword)
        hasher-->>service: Argon2id hash
        service->>users: setPasswordHash(userId, hash)
        users-->>service: done
        service->>sessions: revokeAllForUser(userId, now, exceptSessionId)
        Note right of sessions: tokenVersion unchanged, this session keeps working
        sessions-->>service: other sessions revoked
        service->>service: securityLogger.log(PASSWORD_CHANGED)
        service-->>controller: done
        controller-->>spa: 204
        spa-->>user: Fields cleared, "Password changed. Sessions on other devices were ended."
    end
    deactivate service
    deactivate controller
    deactivate route
    deactivate spa
    deactivate user
    Note over user,sessions: On any other device, the next request answers 401 SESSION_REVOKED and the Web Application ends its session
```

See the [README](./README.md) for the notation key and the element catalogue.
