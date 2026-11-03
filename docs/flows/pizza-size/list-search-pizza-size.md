# UC2 - List and Search Pizza Sizes

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /pizza-size?search={term}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Not detailed (generic error response) |

## Description

A Manager lists the pizza sizes, optionally filtered by a search term.

## Diagram

```mermaid
---
title: "UC2 - List and Search Pizza Sizes - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PizzaSizeController<br/>[Component: Controller]
        participant service as PizzaSizeService<br/>[Component: Service]
        participant repo as PizzaSizeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: GET /pizza-size?search={term}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Query (Joi)
    route->>controller: list(req, res, next)
    activate controller

    controller->>service: listSizes(query, repo)
    activate service

    service->>repo: listPizzaSizes(query)
    activate repo
    repo-->>service: PizzaSize Entity[]
    deactivate repo

    service->>service: map(toSizeDto)
    service-->>controller: PizzaSize DTO[]
    deactivate service

    controller-->>manager: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
