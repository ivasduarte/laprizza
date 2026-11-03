# UC2 - Get Stock

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /stock/:productId` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 404 (product not found), 400 (product not stock-controlled) |

## Description

A Manager or Employee consults the stock of a stock-controlled product. If the product has no stock record yet, one is created with quantity 0 before the stock is returned.

## Diagram

```mermaid
---
title: "UC2 - Get Stock - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as StockController<br/>[Component: Controller]
        participant service as StockService<br/>[Component: Service]
        participant prodRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
        participant repo as StockRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: GET /stock/:productId
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Object ID (Joi)
    route->>controller: getByProductId(req, res, next)
    activate controller

    controller->>service: getStockByProductId(productId, repos)
    activate service

    service->>prodRepo: findById(productId)
    activate prodRepo
    prodRepo-->>service: Product Entity (or null)
    deactivate prodRepo

    alt Product Not Found
      service-->>controller: AppError(404)
    else Product Not Stock-Controlled
      service-->>controller: AppError(400)
    else Valid Product
      service->>repo: findByProductId(productId)
      activate repo
      repo-->>service: Stock Entity (or null)
      deactivate repo

      opt Stock Entity is null
        service->>repo: create({ productId, quantity: 0 })
        activate repo
        repo-->>service: New Stock Entity
        deactivate repo
      end

      service->>service: toStockDTO(Stock)
      service-->>controller: Stock DTO
    end

    deactivate service
    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
