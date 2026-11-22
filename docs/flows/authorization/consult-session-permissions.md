# UC2 - Consult Session Permissions

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `GET /auth/me` |
| Allowed roles | Any authenticated user, whatever the roles (`requireAuthenticated`) |
| Success response | 200 OK `{ "id", "email", "status", "roles": [...], "permissions": [...], "customerId": "<id>" \| null }`, `Cache-Control: no-store` |
| Error handling | 401 `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED` (recorded, [UC1](./access-protected-functionality.md)); 503 `ROLES_UNAVAILABLE` |
| ADRs | [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md), [ADR-0053](../../adr/0053-permission-based-authorization-matrix.md) |

## Description

The Web Application asks for the current user and permissions after the session is restored and whenever the tab becomes visible again, so a role added or removed by an Administrator applies without a new login (WEB03). The login and refresh answers carry the same user object (`toSessionUserDto`), so `/auth/me` is only needed to refresh it.

1. **Route.** `/auth/me` is the first route of the `/auth` router, with its own `noStore`, and has no rate limiter: the Web Application calls it often and it is never counted as a login attempt.
2. **Guard.** `requireAuthenticated` builds the principal as in [UC1](./access-protected-functionality.md). A Guest answers `401 TOKEN_MISSING`. No permission is required: a user without roles still gets an answer (only the Guest permissions).
3. **Current user.** `AuthService.getCurrentUser(principal.userId)` reads the user again, refuses an account that may no longer authenticate (`401 SESSION_REVOKED`), resolves the active roles and builds the DTO with `permissionsFor(roles)`.
4. **Answer.** 200 with id, e-mail, status, roles, sorted permissions and the linked `customerId`. No password hash, token version, login counters or session data.

The Web Application replaces the user of the session with the answer; if a permission was lost while a page that needs it is open, that page shows "access denied" and the menu is rebuilt.

## Diagram

```mermaid
---
title: "UC2 - Consult Session Permissions - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant guard as Authorization middleware<br/>[Component: requireAuthenticated]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant matrix as Permission matrix<br/>[Component: Domain, pure functions]
    end

    activate user
    user->>spa: Returns to the tab (or the session is restored)
    activate spa
    spa->>route: GET /auth/me (Authorization: Bearer <access token>)
    activate route
    route->>route: noStore (Cache-Control: no-store)
    route->>guard: requireAuthenticated
    activate guard
    guard->>guard: Authenticate the request (as in UC1)
    alt Guest or authentication failed
        guard-->>spa: 401 { error: { code } } (ACCESS_DENIED recorded)
        spa-->>user: Session ended, login page
    else Authenticated
        guard->>controller: me(req, res, next)
        deactivate guard
        activate controller
        controller->>service: getCurrentUser(principal.userId)
        activate service
        service->>users: findById(userId)
        activate users
        users-->>service: user
        deactivate users
        alt Missing, inactive or disabled account
            service-->>controller: AppError 401 SESSION_REVOKED
            controller-->>spa: 401 { error: { code: "SESSION_REVOKED" } }
            spa-->>user: Session ended, login page
        else Account may authenticate
            service->>service: resolveRoles(user)
            service->>matrix: permissionsFor(roles)
            matrix-->>service: sorted permissions
            service-->>controller: { id, email, status, roles, permissions, customerId }
            deactivate service
            controller-->>spa: 200 OK
            deactivate controller
            spa->>spa: Replace the session user, rebuild the menu and the route guards
            spa-->>user: Menu and page for the current permissions ("access denied" if the open page is no longer allowed)
        end
    end
    deactivate route
    deactivate spa
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
