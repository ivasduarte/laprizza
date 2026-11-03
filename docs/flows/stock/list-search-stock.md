# UC1 - List and Search Stock

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /stock?search={term}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | Not detailed (generic error response) |

## Description

A Manager or Employee lists the stock records, optionally filtered by a search term. Items without a valid product id are filtered out before the DTOs are built.

## Diagram

```mermaid
---
title: "UC1 - List and Search Stock - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as StockController<br/>[Component: Controller]
        participant service as StockService<br/>[Component: Service]
        participant repo as StockRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: GET /stock?search={term}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Query (Joi)
    route->>controller: list(req, res, next)
    activate controller

    controller->>service: listStock(query, repos)
    activate service

    service->>repo: listStock(query)
    activate repo
    repo-->>service: Stock Entity[]
    deactivate repo

    service->>service: Filter items without a valid productId
    service->>service: map(toStockDTO)
    service-->>controller: Stock DTO[]

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
