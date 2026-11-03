# UC1 - List and Search Catalogue

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /catalogue?search={term}&categoryId={id}` |
| Allowed roles | CUSTOMER, MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | Not detailed (generic error response) |

## Description

A Customer, Manager or Employee lists the catalogue, optionally filtered by a search term and a category. The service always restricts the result to active and sellable products.

## Diagram

```mermaid
---
title: "UC1 - List and Search Catalogue - C4 Dynamic, Level 3 (Component)"
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
    user->>route: GET /catalogue?search={term}&categoryId={id}
    activate route
    route->>route: verifyToken() & requireRole([CUSTOMER, MANAGER, EMPLOYEE])
    route->>route: Validate Query (Joi)
    route->>controller: list(req, res, next)
    activate controller

    controller->>service: listCatalogue(query, repos)
    activate service

    service->>service: Enforce { isActive: true, sellable: true }
    service->>repo: listProducts(filter)
    activate repo
    repo-->>service: Product Entity[]
    deactivate repo

    service->>service: map(toCatalogueDTO)
    service-->>controller: CatalogueItem DTO[]

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
