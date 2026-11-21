# UC3 - Consult Guest Permissions

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API |
| Endpoint | `GET /auth/guest-permissions` |
| Allowed roles | Public (Guest); listed in `PUBLIC_ENTRY_POINTS` |
| Success response | 200 OK `{ "permissions": ["catalogue:read"] }`, `Cache-Control: public, max-age=300` |
| Error handling | None specific (the answer does not depend on the request) |
| ADRs | [ADR-0046](../../adr/0046-permission-based-authorization-matrix.md) |

## Description

Without a session, the Web Application still needs to know what a Guest may use, to build the public menu and to tell "log in" apart from "access denied". It reads the Guest set from the back end instead of keeping its own copy of the matrix.

1. **Route.** Public and without a rate limiter, registered next to `/auth/me`.
2. **Answer.** `AuthController.guestPermissions` returns a copy of `GUEST_PERMISSIONS`. No database access, no user data. The answer is the same for everyone, so it may be cached for 5 minutes.

The Web Application keeps the Guest set in its own store, separate from the session. A page whose permission is not in it sends the Guest to the login; after the login the permissions of the session ([UC2](./consult-session-permissions.md)) are used.

## Diagram

```mermaid
---
title: "UC3 - Consult Guest Permissions - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor guest as Guest<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant controller as AuthController<br/>[Component: Controller]
        participant matrix as Permission matrix<br/>[Component: Domain, pure functions]
    end

    activate guest
    guest->>spa: Opens the Web Application without a session
    activate spa
    spa->>route: GET /auth/guest-permissions
    activate route
    route->>controller: guestPermissions(req, res)
    activate controller
    controller->>matrix: GUEST_PERMISSIONS
    matrix-->>controller: ["catalogue:read"]
    controller-->>spa: 200 { permissions } (Cache-Control: public, max-age=300)
    deactivate controller
    deactivate route
    spa->>spa: Keep the Guest permissions, build the public menu
    spa-->>guest: Public pages (protected pages lead to the login)
    deactivate spa
    deactivate guest
```

See the [README](./README.md) for the notation key and the element catalogue.
