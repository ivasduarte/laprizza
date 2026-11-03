# UC2 - Register User

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /users` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 400 (weak password), 409 (email or username already in use) |

## Description

A Manager registers a new user. The domain validates the password strength, the service hashes the password with Argon2 and persists the user, and a duplicated email or username results in a conflict error.

## Diagram

```mermaid
---
title: "UC2 - Register User - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as UsersController<br/>[Component: Controller]
        participant service as AuthService<br/>[Component: Service]
        participant domain as UsersDomain<br/>[Component: Domain]
        participant repo as UsersRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: POST /users { email, password, role }
    activate route

    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload

    route->>controller: create(req, res, next)
    activate controller
    controller->>service: registerUser(data, repo)
    activate service

    service->>domain: validatePasswordStrength(password)
    activate domain
    domain-->>service: void / DomainError
    deactivate domain

    alt Weak Password
      service-->>controller: AppError(400)
    else Strong Password
      service->>service: Argon2 hash(password)
      service->>repo: create(userData)
      activate repo

      alt Duplicate Email/Username
        repo-->>service: MongoError(11000)
        service-->>controller: AppError(409, "Email/Username in use.")
      else Success
        repo-->>service: User Entity
        deactivate repo

        service->>service: toUserDto(User)
        service-->>controller: User DTO
      end
    end
    deactivate service

    controller-->>manager: Response (201 Created or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
