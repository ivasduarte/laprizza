# UC2 - End Sessions (AA01)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `POST /auth/logout` (this session), `POST /auth/logout-all` (every session of the user) |
| Allowed roles | Authenticated (any active account with a valid session) |
| Success response | 204 No Content, refresh cookie cleared |
| Error handling | 401 `TOKEN_MISSING`, `TOKEN_INVALID`, `SESSION_REVOKED` (the HTTP client refreshes an expired token before the logout), 403 `ORIGIN_NOT_ALLOWED` (logout from another origin) |
| ADRs | [ADR-0012](../../adr/0012-implement-refresh-tokens-for-secure-sessions.md), [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md) |

## Description

**Logout (this session).** The user chooses **Logout** in the account menu of the header. The Web Application goes to the start page and calls `POST /auth/logout`, which requires the `Origin` to be allowed and a valid access token. The back end revokes the `Auth Session` identified by the `sid` of the token, logs `LOGOUT` and clears the refresh cookie. The Web Application always ends its local session, even if the request fails, and the other tabs end theirs through the session channel (AA04).

**Logout on all devices.** On the Change password page the user chooses **Logout on all devices** and confirms it. `POST /auth/logout-all` increments the `tokenVersion` of the user and revokes every one of the user's sessions, logs `LOGOUT_ALL` and clears the cookie.

**Afterwards.** The middleware checks the session and the `tokenVersion` on every protected request, so an access token of an ended session is refused (`401 SESSION_REVOKED`) even before it expires, and its refresh token can no longer be rotated (`401 REFRESH_INVALID`).

## Diagrams

### Logout (this session)

```mermaid
---
title: "UC2a - Logout (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Origin & Auth)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant sessions as AuthSessionsRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Chooses "Logout" in the account menu
    activate spa
    spa->>spa: Goes to the start page
    spa->>route: POST /auth/logout (Bearer token, refresh cookie)
    activate route
    route->>route: noStore, requireAllowedOrigin, requireAuthenticated (user active, tokenVersion, session)
    route->>controller: logout(req, res, next)
    activate controller
    controller->>service: logout({ sessionId, userId }, { ip })
    activate service
    service->>sessions: revoke(sessionId, now)
    sessions-->>service: done
    service->>service: securityLogger.log(LOGOUT)
    service-->>controller: done
    deactivate service
    controller-->>spa: 204, refresh cookie cleared
    deactivate controller
    deactivate route
    spa->>spa: Ends the local session (always, even if the request failed), notifies the other tabs (AA04)
    spa-->>user: Start page, "Login" button in the header
    deactivate spa
    deactivate user
```

### Logout on all devices

```mermaid
---
title: "UC2b - Logout on All Devices (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Auth)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant sessions as AuthSessionsRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Chooses "Logout on all devices" on the Change password page
    activate spa
    spa-->>user: Confirmation dialog
    user->>spa: Confirms
    spa->>spa: Goes to the start page
    spa->>route: POST /auth/logout-all (Bearer token, refresh cookie)
    activate route
    route->>route: noStore, requireAuthenticated
    route->>controller: logoutAll(req, res, next)
    activate controller
    controller->>service: logoutAll({ userId }, { ip })
    activate service
    service->>users: incrementTokenVersion(userId)
    users-->>service: done
    service->>sessions: revokeAllForUser(userId, now)
    sessions-->>service: done
    service->>service: securityLogger.log(LOGOUT_ALL)
    service-->>controller: done
    deactivate service
    controller-->>spa: 204, refresh cookie cleared
    deactivate controller
    deactivate route
    spa->>spa: Ends the local session
    spa-->>user: Start page, "Login" button in the header
    deactivate spa
    deactivate user
    Note over user,sessions: On any other device, the next request answers 401 SESSION_REVOKED and the Web Application ends its session
```

See the [README](./README.md) for the notation key and the element catalogue.
