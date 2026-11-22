# UC1 - Navigate with the Permitted Menu

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `POST /auth/refresh` (refresh cookie), `GET /auth/guest-permissions` |
| Allowed roles | Public (Guest) and any authenticated user |
| Success response | Session user `{ id, email, status, roles, permissions, customerId }` with a new access token, or `401` without a session; `{ "permissions": [...] }` for the Guest |
| Error handling | Refresh refused (no or invalid cookie): the visitor is a Guest. Guest permissions unavailable: an empty list, so only the public pages without a permission are shown |
| ADRs | [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md), [ADR-0053](../../adr/0053-permission-based-authorization-matrix.md), [ADR-0054](../../adr/0054-permission-driven-navigation-in-the-web-application.md) |

## Description

Before the first page is shown, the Web Application learns what the visitor may use:

1. **Session.** It restores the session with the refresh cookie (`POST /auth/refresh`, detailed in [Session Handling (AA04)](../authentication/session-handling.md)). The answer carries the session user with the roles and the permissions computed by the back end from the roles in the database. A refused refresh means there is no session.
2. **Guest permissions.** It reads `GET /auth/guest-permissions` (public, no database access) and keeps them in a store of their own, separate from the session.
3. **Menu.** The layout takes the permissions of the session when authenticated, otherwise the Guest ones (`usePermissions`), and shows the registry entries that are in the navigation, whose session requirement is met and whose permission is granted (`visibleFeatures`). A user with several roles sees the union of their sections; a user without roles sees only what a Guest sees.

The menu is rebuilt whenever the session or its permissions change: after the login, after the logout, and when the user is reloaded ([UC5](./reflect-role-and-status-changes.md)).

## Diagram

```mermaid
---
title: "UC1 - Navigate with the Permitted Menu - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Guest or System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant matrix as Permission matrix<br/>[Component: Domain, pure functions]
    end

    activate user
    user->>spa: Opens the Web Application
    activate spa
    spa->>spa: Session status "loading" (protected routes wait)
    par Restore the session
        spa->>route: POST /auth/refresh (refresh cookie)
        activate route
        route->>controller: refresh(req, res, next)
        activate controller
        controller->>service: refresh(refreshToken, context)
        activate service
        Note over service: Session, rotation and roles: see Session Handling (AA04) and Role Resolution (AA03)
        service->>matrix: permissionsFor(roles)
        matrix-->>service: permissions
        alt Valid refresh cookie
            service-->>controller: { accessToken, user { roles, permissions, ... } }
            controller-->>spa: 200 OK (new refresh cookie)
            spa->>spa: Session "authenticated" with the user and its permissions
        else No cookie, invalid, expired or revoked
            service-->>controller: AppError 401
            deactivate service
            controller-->>spa: 401
            deactivate controller
            spa->>spa: Session "anonymous" (Guest)
        end
        deactivate route
    and Load the Guest permissions
        spa->>route: GET /auth/guest-permissions
        activate route
        route->>controller: guestPermissions(req, res)
        activate controller
        controller->>matrix: GUEST_PERMISSIONS
        matrix-->>controller: ["catalogue:read"]
        controller-->>spa: 200 { permissions } (public, max-age=300)
        deactivate controller
        deactivate route
        spa->>spa: Keep the Guest permissions in their own store
    end
    spa->>spa: permissions = session user's permissions, or the Guest ones without a session
    spa->>spa: visibleFeatures(registry, { permissions, authenticated })
    spa-->>user: Menu with only the permitted sections
    deactivate spa
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
