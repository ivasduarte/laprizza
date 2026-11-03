# UC1 - Create Component Size Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /products/{productId}/size-configurations` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | Happy path only |

## Description

A Manager adds a size configuration (price and stock units consumed) to a product that is a pizza component. The service validates the input, checks that the product and the pizza size exist and are active, makes sure the size is not configured yet and persists the configuration in the product.

## Diagram

```mermaid
---
title: "UC1 - Create Component Size Configuration - C4 Dynamic, Level 3 (Component)"
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
        participant sizeRepo as PizzaSizeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: POST /products/{productId}/size-configurations<br/>{ pizzaSizeId, price, stockUnitsConsumed }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Ids & Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createComponentSizeConfiguration(productId, data, repositories)
    activate service

    service->>domain: normalizeStockUnitsConsumed(stockUnitsConsumed)<br/>& validatePizzaSizeId(pizzaSizeId) & validatePrice(price)
    activate domain
    domain-->>service: valid

    service->>productsRepo: findById(productId)
    activate productsRepo
    productsRepo-->>service: Product Entity (active)
    deactivate productsRepo

    service->>domain: validateProductIsPizzaComponent(product)
    domain-->>service: valid

    service->>sizeRepo: findById(pizzaSizeId)
    activate sizeRepo
    sizeRepo-->>service: PizzaSize Entity (active)
    deactivate sizeRepo

    service->>domain: validateStockUnitsConsumed(product.stockControlled, stockUnitsConsumed)<br/>& findSizeConfiguration(product, pizzaSizeId)
    domain-->>service: valid, size not configured yet
    deactivate domain

    service->>productsRepo: addSizeConfiguration(productId, configuration)
    activate productsRepo
    productsRepo-->>service: Updated Product Entity
    deactivate productsRepo

    service->>service: toComponentSizeConfigurationDTO(productId, configuration)
    service-->>controller: ComponentSizeConfiguration DTO
    deactivate service

    controller-->>manager: Response (201 Created)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
