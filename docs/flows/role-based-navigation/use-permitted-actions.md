# UC4 - Use Permitted Actions

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | The API route of the action, for example `PATCH /stock/{productId}` (`stock:write`) |
| Allowed roles | Those with the write permission of the action (for example Manager for `stock:write`) |
| Success response | The answer of the action (for example 200 with the adjusted stock) |
| Error handling | Without the permission the action is not offered. If the request is sent anyway (permission removed meanwhile, or a crafted request), the API answers `403 FORBIDDEN` (recorded) and the Web Application reloads the user ([UC5](./reflect-role-and-status-changes.md)) |
| ADRs | [ADR-0046](../../adr/0046-permission-based-authorization-matrix.md), [ADR-0047](../../adr/0047-permission-driven-navigation-in-the-web-application.md) |

## Description

A page can be open to users with different permissions; for example, the Stock page is open to Employees and Managers (`stock:read`), but only Managers adjust stock (`stock:write`) or see inactive products (`stock:read:inactive`).

1. **Rendering.** The page asks `useCan` for the permission of each action's API route. Without it, the buttons and forms of that action are not rendered, and read-only pages say so ("read-only" message).
2. **Request.** With it, the action sends its request with the access token.
3. **Check in the back end.** The route checks the permission again ([AA05 UC1](../authorization/access-protected-functionality.md)). Hiding the button is never the only protection.
4. **Refusal.** A `403` (the permission was removed after the page was rendered) shows the translated error and reloads the user; the buttons disappear and, if the page itself is no longer allowed, it becomes "access denied" ([UC5](./reflect-role-and-status-changes.md)).

## Diagram

```mermaid
---
title: "UC4 - Use Permitted Actions - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant guard as Authorization middleware<br/>[Component: requirePermission]
        participant logger as SecurityLogger<br/>[Component: Node.js module]
        participant controller as Controller of the route<br/>[Component: Controller]
    end

    activate user
    user->>spa: Opens the Stock page (stock:read)
    activate spa
    spa->>spa: canWrite = useCan("stock:write"), canSeeInactive = useCan("stock:read:inactive")
    alt Without stock:write (for example Employee)
        spa-->>user: Stock list, "read-only" message, no adjust buttons
    else With stock:write (Manager)
        spa-->>user: Stock list with the adjust buttons
        user->>spa: Adjusts the stock of a product
        spa->>route: PATCH /stock/{productId} (Authorization: Bearer <access token>)
        activate route
        route->>guard: requirePermission("stock:write")
        activate guard
        Note over guard: Roles read from the database on every request (AA05 UC1)
        alt Permission still granted
            guard->>controller: next() (Joi validation, then the controller)
            deactivate guard
            activate controller
            controller-->>spa: 200 OK (adjusted stock)
            deactivate controller
            spa-->>user: Updated stock
        else Permission removed meanwhile
            activate guard
            guard->>logger: log(ACCESS_DENIED, { userId, roles, ..., required: stock:write, reason: MISSING_PERMISSION })
            guard-->>spa: 403 { error: { code: "FORBIDDEN" } }
            deactivate guard
            spa->>spa: Show the translated error, reload the user (UC5)
            spa-->>user: Buttons removed (or "access denied" if the page is no longer allowed)
        end
        deactivate route
    end
    deactivate spa
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
