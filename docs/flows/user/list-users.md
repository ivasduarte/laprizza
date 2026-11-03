# List Users

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /users` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Not detailed |

## Description

A Manager lists all users.

## Diagram

```mermaid
---
title: "List Users - C4 Dynamic, Level 3 (Component)"
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
    manager->>route: GET /users
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>controller: list(req, res, next)
    activate controller

    controller->>service: listUsers(repo)
    activate service

    service->>repo: listUsers()
    activate repo
    repo-->>service: User Entity[]
    deactivate repo

    service->>service: map(toUserDto)
    service-->>controller: User DTO[]
    deactivate service

    controller-->>manager: Response (200 OK)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
