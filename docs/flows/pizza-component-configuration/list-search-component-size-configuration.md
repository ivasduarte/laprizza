# UC2 - List and Search Component Size Configurations

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /products/{productId}/size-configurations, GET /products/{productId}/size-configurations/{sizeId}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager or Employee lists all the size configurations of a product component, or consults the configuration of one specific pizza size.

## Diagram

```mermaid
---
title: "UC2 - List and Search Component Size Configurations - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ComponentSizeConfigurationController<br/>[Component: Controller]
        participant service as ComponentSizeConfigurationService<br/>[Component: Service]
        participant domain as ComponentSizeConfigurationDomain<br/>[Component: Domain]
        participant productsRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user
    user->>route: GET /products/{productId}/size-configurations<br/>or GET /products/{productId}/size-configurations/{sizeId}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>route: Validate Ids (Joi)

    alt List
      route->>controller: list(req, res, next)
      activate controller
      controller->>service: listComponentSizeConfigurations(productId, repositories)
      activate service
      service->>productsRepo: findById(productId)
      activate productsRepo
      productsRepo-->>service: Product Entity
      deactivate productsRepo

      service->>service: toComponentSizeConfigurationDTO(each configuration)
      service-->>controller: ComponentSizeConfiguration DTO list
      deactivate service
      controller-->>user: Response (200 OK)
      deactivate controller
    else Consult by pizza size
      route->>controller: getBySize(req, res, next)
      activate controller
      controller->>service: getComponentSizeConfiguration(productId, pizzaSizeId, repositories)
      activate service
      service->>productsRepo: findById(productId)
      activate productsRepo
      productsRepo-->>service: Product Entity
      deactivate productsRepo

      service->>domain: findSizeConfiguration(product, pizzaSizeId)
      activate domain
      domain-->>service: ComponentSizeConfiguration
      deactivate domain

      service->>service: toComponentSizeConfigurationDTO(productId, configuration)
      service-->>controller: ComponentSizeConfiguration DTO
      deactivate service
      controller-->>user: Response (200 OK)
      deactivate controller
    end

    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
