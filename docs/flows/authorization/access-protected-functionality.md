# UC1 - Access Protected Functionality

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | Every guarded route, for example `GET /kitchen-configurations` (`requirePermission(Permission.KITCHEN_READ)`) |
| Allowed roles | Those whose permissions include the permission of the route ([permission matrix](./README.md#permission-matrix)) |
| Success response | The business answer of the route (the request reaches the controller) |
| Error handling | 401 `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED`; 403 `FORBIDDEN`; 503 `ROLES_UNAVAILABLE`. Every 401 and 403 is recorded (UC5) |
| ADRs | [ADR-0032](../../adr/0032-secure-session-handling-in-the-api-and-the-spa.md), [ADR-0046](../../adr/0046-permission-based-authorization-matrix.md) |

## Description

Every protected route starts with `requirePermission(permission)` (or `requireAuthenticated` for the session routes, [UC2](./consult-session-permissions.md)). The guard builds the principal of the request and checks the permission before any validation of the body, controller or service runs.

1. **Guest.** Without an `Authorization` header the principal is the Guest (`GUEST_PERMISSIONS`), with no database access. If the route allows Guests (for example `catalogue:read`), the request goes on; otherwise it answers `401 TOKEN_MISSING`.
2. **Authentication.** With a header, the authentication middleware requires the `Bearer` scheme and calls `AuthService.authenticateAccessToken`: it verifies the signature and expiry of the access token, reads the user and the session (`sid`) from the database, and checks that the account may authenticate, that the token version matches and that the session is not revoked nor expired. Any failure answers `401` with its code.
3. **Roles and permissions.** The active roles are read from the database (AA03) and turned into permissions with `permissionsFor` (union of the roles plus the Guest set). The principal is `{ userId, roles, permissions, customerId, sessionId }`. If the roles cannot be read, the request fails closed with `503 ROLES_UNAVAILABLE`.
4. **Permission check.** `hasPermission(principal.permissions, permission)`: allowed requests go to the route's validation and controller; a valid session without the permission answers `403 FORBIDDEN`. The answer never names the missing permission.
5. **Record (UC5).** Every refusal writes an `ACCESS_DENIED` security event with the context of the request and the reason, never the token, the cookie or the password.

The Web Application treats the answers the same way for every page (WEB03): `401` ends the session and goes to the login, keeping the requested page to return to after the login; `403` shows "access denied".

## Diagram

```mermaid
---
title: "UC1 - Access Protected Functionality - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Guest or System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant guard as Authorization middleware<br/>[Component: requirePermission]
        participant authn as Authentication middleware<br/>[Component: Express middleware]
        participant service as AuthService<br/>[Component: Service]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant sessions as SessionsRepository<br/>[Component: Repository, MongoDB]
        participant matrix as Permission matrix<br/>[Component: Domain, pure functions]
        participant logger as SecurityLogger<br/>[Component: Node.js module]
        participant controller as Controller of the route<br/>[Component: Controller]
    end

    activate user
    user->>spa: Opens a page or starts an action
    activate spa
    spa->>route: GET /kitchen-configurations (Authorization: Bearer <access token>, if there is a session)
    activate route
    route->>guard: requirePermission("kitchen:read")
    activate guard
    alt No Authorization header (Guest)
        guard->>matrix: GUEST_PERMISSIONS
        matrix-->>guard: ["catalogue:read"]
    else Authorization header
        guard->>authn: authenticate(req)
        activate authn
        alt Not "Bearer <token>"
            authn->>logger: log(ACCESS_DENIED, { ip, method, path, route, userAgent, reason: TOKEN_MISSING })
            authn-->>guard: AppError 401 TOKEN_MISSING
        else Bearer token
            authn->>service: authenticateAccessToken(token)
            activate service
            service->>service: verifyAccessToken(token) (signature, expiry)
            service->>users: findById(claims.sub)
            activate users
            users-->>service: user (status, roles, customerId, tokenVersion)
            deactivate users
            service->>sessions: findById(claims.sid)
            activate sessions
            sessions-->>service: session
            deactivate sessions
            alt Token invalid or expired, account inactive, token version changed, session revoked or expired
                service-->>authn: AppError 401 TOKEN_INVALID / TOKEN_EXPIRED / SESSION_REVOKED
                authn->>logger: log(ACCESS_DENIED, { ip, method, path, route, userAgent, reason })
                authn-->>guard: AppError 401
            else Valid session
                service->>service: resolveRoles(user) (active base roles, read from the database)
                service->>matrix: permissionsFor(roles)
                matrix-->>service: permissions (union of the roles + Guest set)
                service-->>authn: principal { userId, roles, permissions, customerId, sessionId }
                deactivate service
                authn-->>guard: req.principal
            end
        end
        deactivate authn
    end
    guard->>matrix: hasPermission(principal.permissions, "kitchen:read")
    matrix-->>guard: true or false
    alt Allowed
        guard->>controller: next() (Joi validation, then the controller)
        activate controller
        controller-->>spa: Business answer (200, 201, 204, 400, 404...)
        deactivate controller
        spa-->>user: Page or result
    else Guest without the permission (UC5)
        guard->>logger: log(ACCESS_DENIED, { ip, method, path, route, userAgent, required, reason: TOKEN_MISSING })
        guard-->>spa: 401 { error: { code: "TOKEN_MISSING" } }
        spa-->>user: Login page (returns to the requested page after the login)
    else Authenticated without the permission (UC5)
        guard->>logger: log(ACCESS_DENIED, { userId, roles, ip, method, path, route, userAgent, required, reason: MISSING_PERMISSION })
        guard-->>spa: 403 { error: { code: "FORBIDDEN" } }
        spa-->>user: "Access denied"
    else Authentication failed (401 from the authentication middleware)
        guard-->>spa: 401 { error: { code } }
        spa-->>user: Session ended, login page
    end
    deactivate guard
    deactivate route
    deactivate spa
    deactivate user
```

`503 ROLES_UNAVAILABLE` (roles cannot be read) is left out of the diagram; it is documented in [Role Resolution (AA03)](../authentication/role-resolution.md).

See the [README](./README.md) for the notation key and the element catalogue.
