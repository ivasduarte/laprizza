# UC3 - Update Component Size Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PUT /products/{productId}/size-configurations/{sizeId}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager updates the price and the stock units consumed of an existing size configuration of a product component.

## Diagram

```mermaid
---
title: "UC3 - Update Component Size Configuration - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ComponentSizeConfigurationController<br/>[Component: Controller]
        participant service as ComponentSizeConfigurationService<br/>[Component: Service]
        participant domain as ComponentSizeConfigurationDomain<br/>[Component: Domain]
        participant productsRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: PUT /products/{productId}/size-configurations/{sizeId}<br/>{ price, stockUnitsConsumed }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Ids & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updateComponentSizeConfiguration(productId, sizeId, data, repositories)
    activate service

    service->>domain: normalizeStockUnitsConsumed(stockUnitsConsumed) & validatePrice(price)
    activate domain
    domain-->>service: valid

    service->>productsRepo: findById(productId)
    activate productsRepo
    productsRepo-->>service: Product Entity (active)
    deactivate productsRepo

    service->>domain: validateProductIsPizzaComponent(product)<br/>& findSizeConfiguration(product, sizeId)
    domain-->>service: valid, existing ComponentSizeConfiguration

    service->>domain: validateStockUnitsConsumed(product.stockControlled, stockUnitsConsumed)
    domain-->>service: valid
    deactivate domain

    service->>productsRepo: updateSizeConfiguration(productId, sizeId, { price, stockUnitsConsumed })
    activate productsRepo
    productsRepo-->>service: Updated Product Entity
    deactivate productsRepo

    service->>service: toComponentSizeConfigurationDTO(productId, configuration)
    service-->>controller: ComponentSizeConfiguration DTO
    deactivate service

    controller-->>manager: Response (200 OK)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
