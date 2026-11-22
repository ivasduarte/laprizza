# UC2 - Open a Page by URL (and UC3 - Show Access Denied)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | The API routes of the page, for example `GET /kitchen-configurations` (`kitchen:read`) |
| Allowed roles | Those with the permission of the page ([page registry](./README.md#page-registry)) |
| Success response | The page with its data |
| Error handling | Guest: login page, then back to the requested page. Session without the permission: "access denied" at the same URL (UC3), no data request. Unknown path: "page not found". The API answers `401`/`403` anyway if a request is sent (AA05) |
| ADRs | [ADR-0053](../../adr/0053-permission-based-authorization-matrix.md), [ADR-0054](../../adr/0054-permission-driven-navigation-in-the-web-application.md) |

## Description

Opening a section from the menu and typing its URL take the same path: every protected route of the registry is wrapped in a route guard that uses the access rule of the entry (`requiresAuth`, `permission`).

1. **Route.** The router finds the registry entry for the path. An unknown path shows "Page not found" inside the normal layout.
2. **Guard.** `resolveGuard(status, { requiresAuth, allowed })`, where `allowed` is `useCan(permission)` with the permissions of the session or the Guest ones:
   - `wait` while the session is being restored ([UC1](./navigate-with-permitted-menu.md)): "Loading", nothing is decided yet;
   - `login` for a Guest: the login page, keeping the requested page (path and query) to return to after the login;
   - `denied` for a session without the permission: **UC3**, the "access denied" page at the same URL;
   - `allow` otherwise.
3. **Page.** Only on `allow` is the page component loaded, so a refused page never sends its data requests. Its requests still go through the permission check of the API ([AA05 UC1](../authorization/access-protected-functionality.md)).

The "access denied" page is generic: the title "Access Denied", "You do not have permission to open this page" and a link to the home page. It never names the permission, the role or the content of the page, and the menu stays available.

## Diagram

```mermaid
---
title: "UC2 - Open a Page by URL - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Guest or System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant guard as Authorization middleware<br/>[Component: requirePermission]
        participant controller as Controller of the route<br/>[Component: Controller]
    end

    activate user
    user->>spa: Types /kitchen-configurations (or chooses it in the menu)
    activate spa
    spa->>spa: Find the registry entry { requiresAuth: true, permission: "kitchen:read" }
    alt No registry entry for the path
        spa-->>user: "Page not found" (link to the home page)
    else Registry entry found
        spa->>spa: allowed = useCan("kitchen:read")
        spa->>spa: resolveGuard(session status, { requiresAuth, allowed })
        alt wait (session still being restored)
            spa-->>user: "Loading" until the session is known (UC1)
        else login (Guest)
            spa-->>user: Login page (requested page kept in the navigation state)
            Note over user,spa: After the login the user returns to /kitchen-configurations and the guard runs again
        else denied (session without the permission) - UC3
            spa-->>user: "Access Denied" at /kitchen-configurations (generic message, link to the home page)
            Note over spa: The page component is not loaded: no request is sent
        else allow
            spa->>spa: Load the page component
            spa->>route: GET /kitchen-configurations (Authorization: Bearer <access token>)
            activate route
            route->>guard: requirePermission("kitchen:read")
            activate guard
            Note over guard: Authentication and permission check as in AA05 UC1
            guard->>controller: next()
            deactivate guard
            activate controller
            controller-->>spa: 200 OK (page data)
            deactivate controller
            deactivate route
            spa-->>user: Page with its data
        end
    end
    deactivate spa
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
