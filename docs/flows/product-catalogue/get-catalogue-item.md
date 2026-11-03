# UC2 - Get Catalogue Item

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /catalogue/:id` |
| Allowed roles | CUSTOMER, MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 404 (product not found, inactive or not sellable) |

## Description

A Customer, Manager or Employee consults a single catalogue item. Only active and sellable products are visible in the catalogue.

## Diagram

```mermaid
---
title: "UC2 - Get Catalogue Item - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Customer / Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as CatalogueController<br/>[Component: Controller]
        participant service as CatalogueService<br/>[Component: Service]
        participant repo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: GET /catalogue/:id
    activate route
    route->>route: verifyToken() & requireRole([CUSTOMER, MANAGER, EMPLOYEE])
    route->>route: Validate Object ID (Joi)
    route->>controller: getById(req, res, next)
    activate controller

    controller->>service: getCatalogueItemById(id, repos)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: Product Entity (or null)
    deactivate repo

    alt Product not found, inactive or not sellable
      service-->>controller: AppError(404, "Product not found in the catalogue.")
    else Valid Catalogue Item
      service->>service: toCatalogueDTO(Product)
      service-->>controller: CatalogueItem DTO
    end

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
