# Get User

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /users/:id` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 404 (user not found) |

## Description

A Manager consults a single user by its id.

## Diagram

```mermaid
---
title: "Get User - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as UsersController<br/>[Component: Controller]
        participant service as UsersService<br/>[Component: Service]
        participant repo as UsersRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: GET /users/:id
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Object ID (Joi)
    route->>controller: getById(req, res, next)
    activate controller

    controller->>service: getUserById(id, repo)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: User Entity (or null)
    deactivate repo

    alt User Not Found
      service-->>controller: AppError(404)
    else User Found
      service->>service: toUserDto(User)
      service-->>controller: User DTO
    end
    deactivate service

    controller-->>manager: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
