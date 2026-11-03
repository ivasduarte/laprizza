# UC4 - Remove Product Category

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `DELETE /product-categories/{id}` |
| Allowed roles | MANAGER |
| Success response | 204 No Content |
| Error handling | Happy path only |

## Description

A Manager removes a product category. The service checks that no active product uses the category and then deactivates it (logical removal by setting isActive to false).

## Diagram

```mermaid
---
title: "UC4 - Remove Product Category - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductCategoriesController<br/>[Component: Controller]
        participant service as ProductCategoriesService<br/>[Component: Service]
        participant repo as ProductCategoriesRepository<br/>[Component: Repository, MongoDB/Dummy]
        participant productsRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: DELETE /product-categories/{id}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Id (Joi)
    route->>controller: remove(req, res, next)
    activate controller

    controller->>service: removeProductCategory(id, repo, productsRepo)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: ProductCategory Entity (active)
    deactivate repo

    service->>productsRepo: existsByCategory(id)
    activate productsRepo
    productsRepo-->>service: false (no active products)
    deactivate productsRepo

    service->>repo: update(id, { isActive: false })
    activate repo
    repo-->>service: Removed ProductCategory Entity
    deactivate repo

    service-->>controller: void
    deactivate service

    controller-->>manager: Response (204 No Content)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
