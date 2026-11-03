# UC3 - Get Product

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /products/:id` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 404 (product not found) |

## Description

A Manager or Employee consults a single product by its id.

## Diagram

```mermaid
---
title: "UC3 - Get Product - C4 Dynamic, Level 3 (Component)"
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
    user->>route: GET /products/:id
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Object ID (Joi)
    route->>controller: getById(req, res, next)
    activate controller

    controller->>service: getProductById(id, repos)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: Product Entity (or null)
    deactivate repo

    alt Product Not Found
      service-->>controller: AppError(404)
    else Product Found
      service->>service: toProductDTO(Product)
      service-->>controller: Product DTO
    end

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
