# Authentication - Design Diagrams (Mermaid)

The Authentication aggregate covers how a user proves their identity (login), how the resulting session is kept, renewed and ended, and how a Manager registers new users.

> The diagram of [UC1 - Login](./login.md) shows the original single-token flow of BCK01. The current session model (access token, rotating refresh cookie, lockout) is documented in [Session Handling (AA04)](./session-handling.md).
 
> The external login with Google and Microsoft (AA02) is documented in [External Authentication (AA02)](./external-authentication.md). It ends in the same session as the local login.

> How roles are assigned to new accounts and resolved on every login, refresh and request (AA03) is documented in [Role Resolution (AA03)](./role-resolution.md).

> The Administrator role, role changes with their records and the activation invitations (AA06) are documented in [Role Assignment and Activation Invitation (AA06)](./role-assignment-and-invitations.md). Since AA06, `POST /users` is for the Administrator and creates an inactive account without a password.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (2 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Login](./login.md) | `POST /auth/login` | Public (no authentication) | 200 OK (JWT token) | `login.puml` |
| [UC2 - Register User](./register-user.md) | `POST /users` | MANAGER | 201 Created | `register.puml` |
| [Session Handling (AA04)](./session-handling.md) | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Public (login, refresh), authenticated (logout) | 200 OK, 204 No Content | - |
| [External Authentication (AA02)](./external-authentication.md) | `GET /auth/external/providers`, `GET /auth/external/{provider}/login`, `GET /auth/external/{provider}/callback` | Public (no authentication) | 302 to the SPA (`status=success`, cookie `lp_rt`) | - |
| [Role Assignment and Activation Invitation (AA06)](./role-assignment-and-invitations.md) | `/users`, `/users/{id}`, `/users/{id}/roles/{role}`, `/users/{id}/role-history`, `/users/{id}/invitation` | ADMINISTRATOR | 200 OK, 201 Created | - |
| [Role Resolution (AA03)](./role-resolution.md) | `POST /users`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, external callback | As in each endpoint | 403 `NO_ACTIVE_ROLE`, 503 `ROLES_UNAVAILABLE` on failure | - |

## Business rules shown in the diagrams

- Login is public. The user is found by email or username and the password is verified with Argon2.
- Every login failure returns the same generic 401, whether the user does not exist, is inactive or the password is wrong. A dummy Argon2 hash is computed when the user is not found, to mitigate timing attacks.
- A successful login returns a signed JWT.
- Registering a user is restricted to Manager. The domain validates the password strength, the service hashes the password with Argon2 and a duplicated email or username results in 409.
- External login is public and uses OpenID Connect (Authorization Code with PKCE). The user is identified by `(issuer, sub)`, never by e-mail alone.
- A new external user gets an inactive account with the role `CUSTOMER` and no session. An e-mail that already belongs to another user is refused (no automatic linking).
- A successful external login creates the same session as the local login (`establishSession`). The token never appears in a URL.
- Every new account gets the role `CUSTOMER`, in addition to the roles requested by the Manager. Roles are never taken from the identity provider or the client.
- User administration belongs to the `ADMINISTRATOR` role (AA06). New accounts are inactive and receive a unique, expiring, single-use activation invitation; every role change is recorded with its responsible user or system process and time.
- Roles are read from the database on every login, refresh and protected request. An account without an active role gets 403 `NO_ACTIVE_ROLE` and no session. If the roles cannot be read, the request fails closed with 503 `ROLES_UNAVAILABLE`.

## Notation key

| Notation | Meaning |
|---|---|
| Actor (stick figure) | Person using the system, with the role shown in the label |
| Shaded box "Back-end API" | System boundary of the container (Node.js, Express) that holds all the components |
| Shaded box "External System" | System outside the Back-end API boundary |
| Participant label | `Name`, followed by `[Type: technology]` |
| Solid arrow | Call or request |
| Dashed arrow | Return value or response |
| Arrow to the same participant | Work done inside that component |
| Number on an arrow | Order of the interaction (autonumber) |
| `alt` / `else` frame | Alternative flows, only one of them runs |
| `opt` frame | Optional flow, runs only if the condition holds |

## Element catalogue

| Element | Type | Technology | Responsibility | Used in |
|---|---|---|---|---|
| Manager | Person | - | Back-office user with the MANAGER role | [UC2 - Register User](./register-user.md) |
| User | Person | - | Person who is not authenticated yet | [UC1 - Login](./login.md) |
| Route (Joi) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | [UC1 - Login](./login.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | [UC2 - Register User](./register-user.md) |
| AuthController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC1 - Login](./login.md) |
| UsersController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC2 - Register User](./register-user.md) |
| AuthService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| UsersDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC2 - Register User](./register-user.md) |
| UsersRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| User | Person | - | Person who is not authenticated yet | [External Authentication (AA02)](./external-authentication.md) |
| Web Application | Container | React SPA | Shows the provider buttons and the callback page, and restores the session | [External Authentication (AA02)](./external-authentication.md) |
| Identity Provider | External System | OpenID Connect (Google, Microsoft) | Authenticates the user and issues the ID token | [External Authentication (AA02)](./external-authentication.md) |
| ExternalAuthRouter | Component | Express router and middleware | Applies the rate limit, validates the provider name and delegates to the controller | [External Authentication (AA02)](./external-authentication.md) |
| ExternalAuthController | Component | Express controller | Sets and clears the cookies `lp_oidc` and `lp_rt`, and redirects to the provider or to the SPA | [External Authentication (AA02)](./external-authentication.md) |
| ExternalAuthService | Component | Node.js module | Starts and completes the login, resolves the user and creates the account or the session | [External Authentication (AA02)](./external-authentication.md) |
| OidcClient | Component | Adapter over `openid-client` | Discovery, authorization request with PKCE, code exchange and validation of the ID token | [External Authentication (AA02)](./external-authentication.md) |
| ExternalIdentitiesRepository | Component | MongoDB (production) or mock (tests) | Persistence of `(issuer, subject)` per user | [External Authentication (AA02)](./external-authentication.md) |

## Conversion notes

- "Login" keeps the participant name "Route (Joi)" because that route applies no authentication or role check.
- "Register User" is filed here because it is handled by `AuthService`, although it uses `UsersController`, `UsersDomain` and `UsersRepository`, as in the original.
- In "Register User" the repository activation is closed only in the success branch. The original closed it in both branches, which Mermaid does not accept.
