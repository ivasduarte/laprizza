# UC1 - Log In with a Local Account (AA01)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /auth/login` with body `{ "email", "password" }` |
| Allowed roles | Public (Guest) |
| Success response | 200 OK `{ accessToken, tokenType, expiresIn, user }` and the refresh cookie `lp_rt` |
| Error handling | 400 `VALIDATION_FAILED`, 401 `INVALID_CREDENTIALS` (unknown account or wrong password, same body), 403 `ACCOUNT_INACTIVE` / `ACCOUNT_DISABLED` (only with the correct password), 403 `NO_ACTIVE_ROLE`, 429 `TOO_MANY_ATTEMPTS` (account waiting) or `RATE_LIMITED` (IP), both with `Retry-After` |
| ADRs | [ADR-0003](../../adr/0003-authentication-and-authorization.md), [ADR-0009](../../adr/0009-implement-rate-limiting-policies.md), [ADR-0012](../../adr/0012-implement-refresh-tokens-for-secure-sessions.md), [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md), [ADR-0022](../../adr/0022-local-login-without-account-enumeration-and-with-progressive-lockout.md) |

## Description

The user opens the login page from the **Login** button of the header (or is sent there by the route guard of a protected page), types the e-mail and the password and presses "Login". The form checks that both fields are filled and allows one request at a time.

The Back-end API:

1. **Route:** `noStore`, the `login` rate limiter (per IP, counts only failed requests and is reset after a successful one) and Joi `{ email, password }`. Joi messages never echo the values.
2. **Wait:** the e-mail is normalized and its SHA-256 is the key for unknown accounts. If the account has `lockedUntil` in the future, or the e-mail hash has a running wait in `Login Throttles`, the answer is `429 TOO_MANY_ATTEMPTS` with `Retry-After`, before the password is checked.
3. **Password:** an existing account is verified with Argon2id. An unknown account is verified against a fictitious hash (`verifyDummy`), so both paths take the same time.
4. **Failure:** the failure is counted atomically on the user (`registerFailedLogin`) or on the e-mail hash (`Login Throttles`). From the 3rd consecutive failure `computeLockoutDelayMs` sets a wait of 1, 5 and then 30 minutes. `LOGIN_FAILED` is logged with the reason (never the password) and the answer is `401 INVALID_CREDENTIALS`, identical for both cases.
5. **Correct password:** the counters are cleared and the hash is upgraded if it was created with other Argon2 parameters (`needsRehash`).
6. **Session (`establishSession`, shared with AA02):** `evaluateAuthentication` refuses an inactive or disabled account with `403 ACCOUNT_INACTIVE` or `403 ACCOUNT_DISABLED` (`LOGIN_DENIED`). The roles are read from the database (AA03). An `Auth Session` is created with the SHA-256 of a new opaque refresh token and an absolute expiry of 7 days, and a 60-minute access token is signed with only `sub`, `sid`, `tv`, `jti`, `iat`, `exp` and `iss`.
7. **Answer:** `200` with the access token and the user (id, e-mail, roles, permissions, status, never the password hash), and the cookie `lp_rt` (`HttpOnly`, `Secure`, `SameSite=Strict`, path `/api/v2/auth`).

The Web Application keeps the access token only in memory and goes back to the requested page (`safeRedirectPath`). The header then shows the account menu.

The flow is split into three diagrams: the successful login (UC1a), the failed attempts with the progressive wait (UC1b) and the refusal of an account that is not active (UC1c).

## Diagrams

### UC1a - Successful login

```mermaid
---
title: "UC1a - Successful Local Login (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Rate limit)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant rules as Authentication rules<br/>[Component: Domain, pure functions]
        participant hasher as PasswordHasher<br/>[Component: Argon2id]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant sessions as AuthSessionsRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Types the e-mail and the password, presses "Login"
    activate spa
    spa->>route: POST /auth/login { email, password } (credentials include)
    activate route
    route->>route: noStore, login rate limiter (failures only), Joi { email, password }
    route->>controller: login(req, res, next)
    activate controller
    controller->>service: login({ email, password }, { ip, userAgent })
    activate service
    service->>service: normalizeEmail
    service->>users: findByEmailWithPasswordHash(email)
    users-->>service: user (no wait running)
    service->>hasher: verify(passwordHash, password)
    hasher-->>service: match
    service->>users: clearLoginFailures (if there were failures), setPasswordHash if needsRehash
    service->>rules: evaluateAuthentication(user)
    rules-->>service: allowed (account active)
    service->>service: resolveRoles (AA03)
    service->>sessions: create({ userId, refreshTokenHash, tokenVersion, expiresAt in 7 days })
    sessions-->>service: session
    service->>service: signAccessToken({ sub, sid, tv }), log LOGIN_SUCCEEDED
    service-->>controller: accessToken, refreshToken, user
    deactivate service
    controller-->>spa: 200 { accessToken, tokenType, expiresIn, user } and Set-Cookie lp_rt (HttpOnly, Secure, SameSite=Strict)
    deactivate controller
    deactivate route
    spa->>spa: Keeps the access token in memory only
    spa-->>user: Requested page (safeRedirectPath), account menu in the header
    deactivate spa
    deactivate user
```

### UC1b - Failed attempts and progressive wait

```mermaid
---
title: "UC1b - Failed Local Login and Progressive Wait (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Rate limit)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant rules as Authentication rules<br/>[Component: Domain, pure functions]
        participant hasher as PasswordHasher<br/>[Component: Argon2id]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
        participant throttle as LoginThrottleRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Types the e-mail and the password, presses "Login"
    activate spa
    spa->>route: POST /auth/login { email, password }
    activate route
    route->>route: noStore, login rate limiter (429 RATE_LIMITED per IP), Joi
    route->>controller: login(req, res, next)
    activate controller
    controller->>service: login({ email, password }, { ip, userAgent })
    activate service
    service->>service: normalizeEmail, throttleKey = SHA-256(e-mail)
    service->>users: findByEmailWithPasswordHash(email)
    users-->>service: user, or null
    opt Unknown account
        service->>throttle: findByKey(throttleKey)
        throttle-->>service: entry with lockedUntil, or null
    end
    alt Wait running (lockedUntil of the user, or of the e-mail hash)
        service->>service: securityLogger.log(LOGIN_FAILED, LOCKED_OUT)
        service-->>controller: AppError 429 TOO_MANY_ATTEMPTS with Retry-After
        controller-->>spa: 429 with Retry-After
        spa-->>user: "Too many failed attempts. Try again in N min."
    else No wait
        alt Account exists
            service->>hasher: verify(passwordHash, password)
        else Unknown account
            service->>hasher: verifyDummy(password), same cost
        end
        hasher-->>service: no match
        alt Account exists
            service->>users: registerFailedLogin(userId)
        else Unknown account
            service->>throttle: registerFailure(throttleKey)
        end
        service->>rules: computeLockoutDelayMs(failedAttempts)
        rules-->>service: 0 below 3 failures, then 1 min, 5 min, 30 min
        opt Delay above zero
            service->>users: extendLockout(userId, lockedUntil) (existing account)
            service->>throttle: extendLockout(throttleKey, lockedUntil) (unknown e-mail)
        end
        service->>service: securityLogger.log(LOGIN_FAILED, INVALID_PASSWORD or UNKNOWN_ACCOUNT)
        service-->>controller: AppError 401 INVALID_CREDENTIALS
        controller-->>spa: 401, same body for both cases
        spa-->>user: "Incorrect email or password."
    end
    deactivate service
    deactivate controller
    deactivate route
    deactivate spa
    deactivate user
```

### UC1c - Correct password, account not active

```mermaid
---
title: "UC1c - Local Login of an Account that is not Active (AA01) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Rate limit)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant rules as Authentication rules<br/>[Component: Domain, pure functions]
        participant hasher as PasswordHasher<br/>[Component: Argon2id]
        participant users as UsersRepository<br/>[Component: Repository, MongoDB]
    end

    activate user
    user->>spa: Types the e-mail and the password, presses "Login"
    activate spa
    spa->>route: POST /auth/login { email, password }
    activate route
    route->>route: noStore, login rate limiter, Joi
    route->>controller: login(req, res, next)
    activate controller
    controller->>service: login({ email, password }, { ip, userAgent })
    activate service
    service->>users: findByEmailWithPasswordHash(email)
    users-->>service: user (no wait running)
    service->>hasher: verify(passwordHash, password)
    hasher-->>service: match
    service->>users: clearLoginFailures (if there were failures)
    service->>rules: evaluateAuthentication(user)
    rules-->>service: ACCOUNT_INACTIVE or ACCOUNT_DISABLED
    Note right of rules: Only revealed after the correct password, so the status does not enumerate accounts
    service->>service: securityLogger.log(LOGIN_DENIED, reason)
    service-->>controller: AppError 403 ACCOUNT_INACTIVE or ACCOUNT_DISABLED
    deactivate service
    controller-->>spa: 403, no session and no cookie
    deactivate controller
    deactivate route
    spa-->>user: Translated message (use the activation invitation, or contact the manager)
    deactivate spa
    deactivate user
```

An active account without any active role gets `403 NO_ACTIVE_ROLE` at the same point; that rule is shown in [Role Resolution (AA03)](./role-resolution.md). The renewal of the access token, the restore after a reload and the route guard are in [Session Handling (AA04)](./session-handling.md). See the [README](./README.md) for the notation key and the element catalogue.
