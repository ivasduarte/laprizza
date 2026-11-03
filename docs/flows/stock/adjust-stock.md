# UC3 - Adjust Stock

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /stock/:productId` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 404 (product not found), 400 (product not stock-controlled, invalid amount or negative resulting quantity) |

## Description

A Manager or Employee increases or decreases the stock of a stock-controlled product. The stock record is created on first use and an operation that would leave a negative quantity is rejected.

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
    user->>route: PATCH /stock/:productId { amount, operation }
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
      service->>domain: validateStockChange(amount)
      activate domain
      domain-->>service: validAmount / DomainError
      deactivate domain

      alt Domain Validation Failed
        service-->>controller: AppError(400)
      else Amount valid
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

        alt operation is increase
          service->>service: newQuantity = quantity + amount
        else operation is decrease
          service->>service: newQuantity = quantity - amount
        end

        alt newQuantity is below 0
          service-->>controller: AppError(400, "Cannot result in negative quantity")
        else Success
          service->>repo: updateQuantity(productId, newQuantity)
          activate repo
          repo-->>service: Updated Stock Entity
          deactivate repo

          service->>service: toStockDTO(Stock)
          service-->>controller: Stock DTO
        end
      end
    end
    deactivate service

    controller-->>user: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
