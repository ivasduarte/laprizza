# UC1 - Login

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /auth/login` |
| Allowed roles | Public (no authentication) |
| Success response | 200 OK (JWT token) |
| Error handling | 401 (invalid credentials) |

## Description

A user authenticates with an email or username and a password. The service verifies the password with Argon2 and issues a signed JWT. When the user does not exist or is inactive, a dummy Argon2 hash is computed to mitigate timing attacks, and the same generic error is returned for every failure.

## Diagram

```mermaid
---
title: "UC1 - Login - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as User<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi)<br/>[Component: Router and middleware]
        participant controller as AuthController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant repo as UsersRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user

    user->>route: POST /auth/login {identifier, password}
    activate route

    route->>route: Validate Payload
    route->>controller: login(req, res, next)
    activate controller

    controller->>service: login(credentials, repo)
    activate service

    service->>repo: findByEmailOrUsername(identifier)
    activate repo
    repo-->>service: User Entity (or null)
    deactivate repo

    alt User not found or inactive
      service->>service: perform dummy Argon2 hash (timing attack mitigation)
      service-->>controller: AppError(401, "Invalid Credentials.")
    else User found
      service->>service: Argon2 verify(hash, password)

      alt Invalid password
        service-->>controller: AppError(401, "Invalid Credentials.")
      else Valid password
        service->>service: jwt.sign(payload, secret, 35m)
        service-->>controller: token
      end
    end
    deactivate service

    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
