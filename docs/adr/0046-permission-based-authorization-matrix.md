# Permission-Based Authorization with a Single Role Matrix

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-21

Technical Story: [AA05] Authorization Enforcement

## Context and Problem Statement

Until AA05, each route checked role names (`requireRole('MANAGER')`, `requireRole('MANAGER', 'EMPLOYEE')`), a user had a single `role`, and the Web Application repeated its own lists of roles to decide what to show. AA05 requires that permissions are checked whenever protected information or functionality is requested, that unauthorized sections and actions are blocked in the Web Application and in the services, that an authentication failure is told apart from a lack of permission, that a user never reads another customer's personal data by changing a reference, that refused attempts are recorded without secrets, that the permissions follow Table 1 with least privilege, and that automated checks show permitted and denied operations for the base roles. Users may have more than one role, and a Guest has no session at all.

## Decision Drivers

* One source of truth for who may do what, shared by the API and the Web Application.
* Least privilege (Table 1), with the union of the roles for users with several roles.
* Adding or changing a role must be a change of data, not of every route.
* The server is the only authority: roles are read from the database (AA03), never trusted from the token or the client.
* A new route must not be published without deciding who may use it.

## Considered Options

* Authorization model: (A) permissions granted by a role → permission matrix, checked by the routes, (B) role names checked by each route, (C) attribute/policy rules per resource.
* Where the permissions live: (A) computed on every request from the roles in the database, (B) embedded in the access token.
* Guest: (A) a fixed permission set used when there is no session, (B) a `GUEST` role stored in the user model.
* Data ownership: (A) "own" endpoints that take the customer from the session (`/customers/me`), (B) the same `/customers/{id}` endpoint with an ownership check on the parameter.
* Exposing the permissions to the Web Application: (A) `GET /auth/me` and `GET /auth/guest-permissions`, (B) a copy of the matrix in the Web Application.
* Keeping the matrix and the routes aligned: (A) automated guard-rail tests over the route inventory and a hand-written expected matrix, (B) code review only.

## Decision Outcome

* **Permission matrix (A).** `domain/auth/permissions.domain.js` defines the permission catalogue (`resource:action[:scope]`), `GUEST_PERMISSIONS`, `ROLE_PERMISSIONS` and the pure functions `permissionsFor(roles)` (union, sorted) and `hasPermission`. Routes use `requirePermission(Permission.X)` or, for session routes, `requireAuthenticated`; no route, service or page compares role names.
* **Computed per request (A).** The access token carries only the user, the session and the token version. On every protected request the principal's roles are read from the database and turned into permissions, so a role change applies on the next request, without a new login.
* **Guest as a permission set (A).** A request without `Authorization` gets a Guest principal with `GUEST_PERMISSIONS` (`catalogue:read`). Every authenticated user also has them. There is no `GUEST` role.
* **401 versus 403.** No token, an invalid or expired token or a revoked session answers `401` (`TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED`); a valid session without the permission answers `403 FORBIDDEN`. A Guest asking for a protected route always gets `401`, so the Web Application sends them to the login.
* **Own endpoints (A).** A customer reads their own record only through `GET /customers/me` (`customers:read:own`), which takes `customerId` from the session; `GET /customers/{id}` needs `customers:read` (Manager). There is no parameter to tamper with. The rule is in `domain/auth/ownership.domain.js` (`canReadCustomer`).
* **Endpoints for the Web Application (A).** `GET /auth/me` (authenticated, `no-store`) returns `{ id, email, status, roles, permissions, customerId }` read from the database; `GET /auth/guest-permissions` (public) returns the Guest set. The Web Application decides menus, routes and buttons with these permissions only (WEB03); the API still checks every request.
* **Refused attempts recorded.** Every 401 and 403 writes an `ACCESS_DENIED` security event with the user, roles, IP, method, path, route, user agent, required permission and reason. The security logger drops fields whose name looks like a secret (password, token, cookie, authorization, hash) and redacts values that look like a Bearer token, a JWT or an Argon2 hash.
* **Guard-rail tests (A).** `api.route-permissions.test.js` lists every route of the Express app and fails if one has no guard and is not a listed public entry point, if a guarded route has no row in the expected matrix, or if a route uses an unknown permission. `api.authorization-matrix.test.js` sends every protected route as every persona (Guest, Customer, Employee, Manager, Administrator, users with two roles, user without roles) and checks allowed, 401 or 403, and the security event. The expected matrix (`test/support/authorization-matrix.js`) is written by hand from Table 1, never derived from `ROLE_PERMISSIONS`.
* **Migration.** `migrations/aa05-user-roles.js` turns the single `role` into the array `roles` (and back, keeping the most privileged role). The server refuses to start while a user still has the old field.

### Positive Consequences

* Table 1 is in one data structure; a role (for example `ADMINISTRATOR`, AA06) was added by adding its row, without changing routes.
* A wrong permission on a route, or a route without a guard, makes the tests fail.
* Users with several roles get exactly the union of their permissions; a user without roles gets only the Guest permissions.
* Role changes and account deactivation apply on the next request.
* The Web Application and the API use the same permissions, so the menu never offers what the API refuses.

### Negative Consequences

* Every protected request reads the user and the session from the database.
* The permission catalogue and the hand-written expected matrix must be kept up to date with each new route.
* "Own" data needs its own endpoints instead of reusing the generic ones.
* Users of the old single-role model need a migration before the server starts.

## Pros and Cons of the Options

### Permission matrix

* Good, because roles map to Table 1 in one place and routes depend only on what they protect.
* Bad, because there is one more level (permission) between the role and the route.

### Role names per route

* Good, because it is direct and was already in place.
* Bad, because the same role list is repeated in every route and in the Web Application, and a new role means changing all of them.

### Attribute or policy rules

* Good, because they express ownership and context.
* Bad, because they are more complex than Table 1 needs; ownership is covered by the "own" endpoints.

### Permissions in the access token

* Good, because no database read is needed to authorize.
* Bad, because a removed role would keep working until the token expires, against AA03.

### A `GUEST` role

* Good, because Guests would use the same mechanism as roles.
* Bad, because a Guest has no account: the role could be assigned, removed or stored by mistake.

### Ownership check on `/customers/{id}`

* Good, because there is one endpoint.
* Bad, because a missing check on any new parameter would expose another customer's data.

### Copy of the matrix in the Web Application

* Good, because no request is needed.
* Bad, because the two copies drift apart and the Web Application would show actions the API refuses.

### Code review only

* Good, because it needs no test code.
* Bad, because an unguarded route is easy to miss in a review.
