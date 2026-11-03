# UC4 - Remove Component Size Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `DELETE /products/{productId}/size-configurations/{sizeId}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager removes the configuration of a given pizza size from a product component. The removed configuration is returned.

## Diagram

```mermaid
---
title: "UC4 - Remove Component Size Configuration - C4 Dynamic, Level 3 (Component)"
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
    manager->>route: DELETE /products/{productId}/size-configurations/{sizeId}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Ids (Joi)
    route->>controller: remove(req, res, next)
    activate controller

    controller->>service: removeComponentSizeConfiguration(productId, sizeId, repositories)
    activate service

    service->>productsRepo: findById(productId)
    activate productsRepo
    productsRepo-->>service: Product Entity
    deactivate productsRepo

    service->>domain: findSizeConfiguration(product, sizeId)
    activate domain
    domain-->>service: ComponentSizeConfiguration
    deactivate domain

    service->>productsRepo: removeSizeConfiguration(productId, sizeId)
    activate productsRepo
    productsRepo-->>service: Updated Product Entity
    deactivate productsRepo

    service->>service: toComponentSizeConfigurationDTO(productId, configuration)
    service-->>controller: Removed ComponentSizeConfiguration DTO
    deactivate service

    controller-->>manager: Response (200 OK)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
