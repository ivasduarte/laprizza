# UC2 - List and Search Products

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /products?search={term}&categoryId={id}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | Not detailed (generic error response) |

## Description

A Manager or Employee lists the products, optionally filtered by a search term, a category and other query parameters.

## Diagram

```mermaid
---
title: "UC2 - List and Search Products - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductsController<br/>[Component: Controller]
        participant service as ProductsService<br/>[Component: Service]
        participant repo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: GET /products?search={term}&categoryId={id}...
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Query (Joi)
    route->>controller: list(req, res, next)
    activate controller

    controller->>service: listProducts(query, repos)
    activate service

    service->>repo: listProducts(query)
    activate repo
    repo-->>service: Product Entity[]
    deactivate repo

    service->>service: map(toProductDTO)
    service-->>controller: Product DTO[]

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
