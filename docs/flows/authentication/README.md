# Authentication - Design Diagrams (Mermaid)

The Authentication aggregate covers how a user proves their identity (login), how the resulting session is kept, renewed and ended, and how a Manager registers new users.

> The diagram of [UC1 - Login](./login.md) shows the original single-token flow of BCK01. The current session model (access token, rotating refresh cookie, lockout) is documented in [Session Handling (AA04)](./session-handling.md).

> The local authentication of AA01 (login by e-mail and password, logout, password recovery by e-mail and password change) is documented in five documents whose diagrams also show the **Web Application**, as a single container: [Local Login](./local-login.md), [End Sessions](./end-sessions.md), [Request Password Recovery](./request-password-recovery.md), [Reset Password](./reset-password.md) and [Change Password](./change-password.md). They replace the BCK01 login.
 
> The external login with Google and Microsoft (AA02) is documented in [External Authentication (AA02)](./external-authentication.md). It ends in the same session as the local login.

> How roles are assigned to new accounts and resolved on every login, refresh and request (AA03) is documented in [Role Resolution (AA03)](./role-resolution.md).

> How permissions are checked on every request, from the role → permission matrix, with 401 versus 403, the Guest permissions, data ownership and the record of refused attempts (AA05), is documented in [Authorization Enforcement (AA05)](../authorization/README.md).

> The Administrator role, role changes with their records and the activation invitations (AA06) are documented in [Role Assignment and Activation Invitation (AA06)](./role-assignment-and-invitations.md). Since AA06, `POST /users` is for the Administrator and creates an inactive account without a password.

> How an invited user activates the account with the invitation, by setting the password (local account) or by signing in at the linked identity provider (external account) (AA07), is documented in [Account Activation (AA07)](../account-activation/README.md).

Process View (SAD), Level 3, documented as C4 dynamic diagrams. The BCK01 diagrams (UC1 and UC2) show only the **Back-end API** container and were converted from the original PlantUML sequence diagrams; the AA01 diagrams also show the **Web Application**.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Login](./login.md) | `POST /auth/login` | Public (no authentication) | 200 OK (JWT token) | `login.puml` |
| [UC2 - Register User](./register-user.md) | `POST /users` | MANAGER | 201 Created | `register.puml` |
| [Session Handling (AA04)](./session-handling.md) | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Public (login, refresh), authenticated (logout) | 200 OK, 204 No Content | - |
| [External Authentication (AA02)](./external-authentication.md) | `GET /auth/external/providers`, `GET /auth/external/{provider}/login`, `GET /auth/external/{provider}/callback` | Public (no authentication) | 302 to the SPA (`status=success`, cookie `lp_rt`) | - |
| [Role Assignment and Activation Invitation (AA06)](./role-assignment-and-invitations.md) | `/users`, `/users/{id}`, `/users/{id}/roles/{role}`, `/users/{id}/role-history`, `/users/{id}/invitation` | ADMINISTRATOR | 200 OK, 201 Created | - |
| [Account Activation (AA07)](../account-activation/README.md) | `POST /auth/activation/inspect`, `POST /auth/activation/local`, `POST /auth/external/activate` | Public (no authentication) | 200 OK, 204 No Content, 303 to the identity provider | - |
| [Role Resolution (AA03)](./role-resolution.md) | `POST /users`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, external callback | As in each endpoint | 403 `NO_ACTIVE_ROLE`, 503 `ROLES_UNAVAILABLE` on failure | - |
| [UC1 - Log In with a Local Account (AA01)](./local-login.md) | `POST /auth/login` | Public (Guest) | 200 OK (access token, cookie `lp_rt`) | - |
| [UC2 - End Sessions (AA01)](./end-sessions.md) | `POST /auth/logout`, `POST /auth/logout-all` | Authenticated | 204 No Content | - |
| [UC3 - Request Password Recovery (AA01)](./request-password-recovery.md) | `POST /auth/password/forgot` | Public (Guest) | 202 Accepted (always the same) | - |
| [UC4 - Reset Password (AA01)](./reset-password.md) | `POST /auth/password/reset` | Public (Guest) | 204 No Content | - |
| [UC5 - Change Password (AA01)](./change-password.md) | `POST /auth/password/change` | Authenticated | 204 No Content | - |

## Business rules shown in the diagrams

- Login is public. Since AA01 the user is found by the normalized e-mail only and the password is verified with Argon2id. (BCK01 also accepted the username and returned a single JWT.)
- An unknown account and a wrong password return the same `401 INVALID_CREDENTIALS`; a fictitious Argon2 verification runs for unknown accounts so the time is the same. An inactive or disabled account gets `403 ACCOUNT_INACTIVE` or `403 ACCOUNT_DISABLED` only after the correct password.
- From the 3rd consecutive failure the account waits 1, 5 and then 30 minutes (`429 TOO_MANY_ATTEMPTS` with `Retry-After`), also for unknown e-mails, counted by the SHA-256 of the e-mail. Failed logins and failed password changes are also limited per IP.
- A successful login creates an `Auth Session` and returns a 60-minute access token, kept only in memory by the SPA, plus a 7-day rotating refresh token in the `HttpOnly`, `Secure`, `SameSite=Strict` cookie `lp_rt`.
- Logout revokes the current session; logout on all devices also increments `tokenVersion`. A revoked session is refused on the next request, even before the access token expires.
- Password recovery always answers `202` with the same body and does the work afterwards. Only active accounts receive the e-mail, with a single-use link valid for 30 minutes; only the SHA-256 of the token is stored and the token travels in the URL fragment. A reset ends every session of the user and opens none.
- A password change requires the current password, keeps the current session and ends every other one. The same password policy applies everywhere a password is chosen (8 to 64 characters, one uppercase letter, one special character).
- Registering a user (BCK01 diagram) was restricted to Manager, with a password. Since AA06 `POST /users` belongs to the Administrator, accepts no password and creates an inactive account with an invitation; a duplicated e-mail or username still results in 409.
- External login is public and uses OpenID Connect (Authorization Code with PKCE). The user is identified by `(issuer, sub)`, never by e-mail alone.
- A new external user gets an active account with the role `CUSTOMER` only and a session: the verified identity validates the account (clarification of 2026-11-21), so no invitation is sent. An e-mail that already belongs to another user is refused (no automatic linking).
- A successful external login creates the same session as the local login (`establishSession`). The token never appears in a URL.
- Every new account gets the role `CUSTOMER`, in addition to the roles requested by the Administrator (AA06). Roles are never taken from the identity provider or the client.
- User administration belongs to the `ADMINISTRATOR` role (AA06). New accounts are inactive and receive a unique, expiring, single-use activation invitation; every role change is recorded with its responsible user or system process and time.
- Roles are read from the database on every login, refresh and protected request. An account without an active role gets 403 `NO_ACTIVE_ROLE` and no session. If the roles cannot be read, the request fails closed with 503 `ROLES_UNAVAILABLE`.

## Related ADRs

| ADR | Decision | Status |
|---|---|---|
| [ADR-0004](../../adr/0004-authentication-and-authorization.md) | Authentication and authorization | Accepted, amended |
| [ADR-0008](../../adr/0008-implement-rate-limiting-policies.md) | Rate limiting policies (`login` and `forgot` limiters) | Accepted, amended |
| [ADR-0011](../../adr/0011-implement-refresh-tokens-for-secure-sessions.md) | Refresh tokens for secure sessions | Accepted |
| [ADR-0032](../../adr/0032-secure-session-handling-in-the-api-and-the-spa.md) | Secure session handling in the API and the SPA | Accepted |
| [ADR-0043](../../adr/0043-local-login-without-account-enumeration-and-with-progressive-lockout.md) | Local login without account enumeration and with progressive lockout | Accepted |
| [ADR-0044](../../adr/0044-password-recovery-with-single-use-hashed-tokens.md) | Password recovery with single-use hashed tokens | Accepted |
| [ADR-0045](../../adr/0045-e-mail-delivery-with-nodemailer-and-mailpit.md) | E-mail delivery with Nodemailer and Mailpit | Accepted |
| [ADR-0041](../../adr/0041-administrator-role-role-change-records-and-activation-invitations.md) | Administrator role, role change records and activation invitations (AA06) | Accepted |
| [ADR-0046](../../adr/0046-permission-based-authorization-matrix.md) | Permission-based authorization matrix (AA05; roles resolved per request, AA03) | Accepted |

## Notation key

| Notation | Meaning |
|---|---|
| Actor (stick figure) | Person using the system, with the role shown in the label |
| Participant "Web Application" | Container (React, Vite) shown as a whole, without its components (AA01 diagrams) |
| Shaded box "Back-end API" | System boundary of the container (Node.js, Express) that holds all the components; the only container shown in detail |
| Shaded box "External System" | System outside the Back-end API boundary |
| Participant "E-mail Server" | External SMTP server (Mailpit) that delivers the recovery e-mails |
| Participant label | `Name`, followed by `[Type: technology]` |
| Solid arrow | Call or request |
| Dashed arrow | Return value or response |
| Arrow to the same participant | Work done inside that component |
| Number on an arrow | Order of the interaction (autonumber) |
| `alt` / `else` frame | Alternative flows, only one of them runs |
| `opt` frame | Optional flow, runs only if the condition holds |
| `Note` | Reference to another diagram or a remark |

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
| System User | Person | - | Any person with a local account (or who wants to recover one) | AA01 diagrams |
| Web Application | Container | React SPA (Vite) | Login, forgot password, reset password and change password pages, and the account menu of the header (Login, Change password, Logout). Keeps the access token in memory only | AA01 diagrams |
| Route (Joi & Rate limit) | Component | Express router and middleware | `noStore`, the `login` or `forgot` rate limiter and Joi validation of the body | [Local Login](./local-login.md), [Request Password Recovery](./request-password-recovery.md) |
| Route (Origin & Auth), Route (Auth) | Component | Express router and middleware | `noStore`, `requireAllowedOrigin` (logout only) and `requireAuthenticated` (access token, active account, `tokenVersion`, session not revoked) | [End Sessions](./end-sessions.md) |
| Route (Rate limit, Auth & Joi) | Component | Express router and middleware | `noStore`, the `login` rate limiter, `requireAuthenticated` and Joi validation of the body | [Change Password](./change-password.md) |
| Authentication rules | Component | Domain, pure functions | `evaluateAuthentication` (account status) and `computeLockoutDelayMs` (progressive wait) | [Local Login](./local-login.md) |
| PasswordHasher | Component | Argon2id | Hashes and verifies passwords, `verifyDummy` for unknown accounts, `needsRehash` | [Local Login](./local-login.md), [Reset Password](./reset-password.md), [Change Password](./change-password.md) |
| LoginThrottleRepository | Component | MongoDB, collection `Login Throttles` | Failed attempts and wait of unknown e-mails, keyed by the SHA-256 of the e-mail (TTL 24 h) | [Local Login](./local-login.md) |
| AuthSessionsRepository | Component | MongoDB, collection `Auth Sessions` | Creates, rotates and revokes sessions (hash of the refresh token, absolute expiry) | AA01 diagrams except [Request Password Recovery](./request-password-recovery.md) |
| PasswordResetTokensRepository | Component | MongoDB, collection `Password Reset Tokens` | Stores the SHA-256 of the recovery tokens, invalidates the previous ones and consumes a token atomically | [Request Password Recovery](./request-password-recovery.md), [Reset Password](./reset-password.md) |
| EmailService | Component | Nodemailer | Sends the plain-text e-mails through SMTP | [Request Password Recovery](./request-password-recovery.md) |
| E-mail Server | External System | Mailpit (SMTP) | Receives the e-mails and shows them in its web interface (port 8025) | [Request Password Recovery](./request-password-recovery.md), [AA06](./role-assignment-and-invitations.md) |
| Administrator | Person | - | User with the ADMINISTRATOR role: manages accounts, roles and activation invitations | [AA06](./role-assignment-and-invitations.md) |
| UsersRouter | Component | Express router and middleware | `requirePermission(users:read / users:create / users:manage / users:invite)` and Joi (no password on creation) | [AA06](./role-assignment-and-invitations.md) |
| UsersService | Component | Node.js module | `createUser`, `updateUser`, `addRole`, `removeRole`, `getRoleHistory`, `reissueInvitation`, `listAssignableRoles`; `assertRoleChangeAllowed` and the compensation when a record fails | [AA06](./role-assignment-and-invitations.md) |
| RoleChangeRecorder | Component | Node.js module | Writes the append-only `Role Changes` records with the actor (`USER` or `SYSTEM` process) and the time | [AA06](./role-assignment-and-invitations.md), [AA03](./role-resolution.md) |
| ActivationInvitationService | Component | Node.js module | Issues an invitation (revokes the pending one, stores the SHA-256 and expiry, sends the e-mail) and revokes pending invitations | [AA06](./role-assignment-and-invitations.md) |
| Role resolution rules | Component | Domain, pure functions | `withInitialCustomerRole`, `activeRoles`, `evaluateRoleAuthorization`; `AuthService.resolveRoles` reads the stored roles and fails closed | [AA03](./role-resolution.md) |

## Conversion notes

- "Login" keeps the participant name "Route (Joi)" because that route applies no authentication or role check.
- "Register User" is filed here because it is handled by `AuthService`, although it uses `UsersController`, `UsersDomain` and `UsersRepository`, as in the original.
- In "Register User" the repository activation is closed only in the success branch. The original closed it in both branches, which Mermaid does not accept.
