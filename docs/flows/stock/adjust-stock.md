# UC3 - Adjust Stock

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /stock/:productId` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 404 (product not found), 400 (product not stock-controlled, `VALIDATION_FAILED`, `STOCK_INVALID_AMOUNT`, `STOCK_NEGATIVE` or `STOCK_ABOVE_MAXIMUM`) |

## Description

A Manager or Employee changes the stock of a stock-controlled product in one of three ways (WEB04):

| `operation` | `amount` | Result | Example (current 150) |
|---|---|---|---|
| `increase` | units received, > 0 | `quantity + amount` | 10 → 160 |
| `decrease` | units removed, > 0 | `quantity - amount` | 72 → 78 |
| `set` | counted quantity, >= 0 | `amount` | 78 → 78 (physical count, no subtraction by the user) |

The stock record is created on first use. The result must stay between 0 and `MAX_STOCK_QUANTITY` (100 000 units, `stock.domain.js`); outside that range the change is refused (`STOCK_NEGATIVE`, `STOCK_ABOVE_MAXIMUM`). The rule lives in the domain function `nextStockQuantity`.

In the SPA (`stock-adjust-form.jsx`, `stock-rules.js`), every movement of 1000 units or more (`UNUSUAL_CHANGE_UNITS`) is shown back to the user (from → to) for confirmation before it is sent; a stock out below that is confirmed as before.

## Diagram

```mermaid
---
title: "UC3 - Adjust Stock - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as StockController<br/>[Component: Controller]
        participant service as StockService<br/>[Component: Service]
        participant domain as StockDomain<br/>[Component: Domain]
        participant prodRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
        participant repo as StockRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: PATCH /stock/:productId { amount, operation: increase | decrease | set }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Object ID & Payload (Joi)
    route->>controller: adjustStock(req, res, next)
    activate controller

    controller->>service: adjustStock(productId, amount, operation, repos)
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

      service->>domain: nextStockQuantity(quantity, amount, operation)
      activate domain
      domain-->>service: newQuantity / DomainError(code)
      deactivate domain

      alt Invalid amount, below 0 or above MAX_STOCK_QUANTITY
        service-->>controller: AppError(400, STOCK_INVALID_AMOUNT | STOCK_NEGATIVE | STOCK_ABOVE_MAXIMUM)
      else Success
        service->>repo: updateQuantity(productId, newQuantity)
        activate repo
        repo-->>service: Updated Stock Entity
        deactivate repo

        service->>service: toStockDTO(Stock)
        service-->>controller: Stock DTO
      end
    end
    deactivate service

    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
