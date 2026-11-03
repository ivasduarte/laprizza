# UC3 - Update Product Category

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PUT /product-categories/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager updates the name of a product category. The domain normalizes and validates the name before the stored category is updated.

## Diagram

```mermaid
---
title: "UC3 - Update Product Category - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductCategoriesController<br/>[Component: Controller]
        participant service as ProductCategoriesService<br/>[Component: Service]
        participant domain as ProductCategoriesDomain<br/>[Component: Domain]
        participant repo as ProductCategoriesRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: PUT /product-categories/{id} { name }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Id & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updateProductCategory(id, data, repo)
    activate service

    service->>domain: normalizeName(data.name) & validateName(name)
    activate domain
    domain-->>service: normalizedName
    deactivate domain

    service->>repo: findById(id)
    activate repo
    repo-->>service: ProductCategory Entity (active)

    service->>repo: update(id, categoryData)
    repo-->>service: Updated ProductCategory Entity
    deactivate repo

    service->>service: toProductCategoryDTO(ProductCategory)
    service-->>controller: ProductCategory DTO
    deactivate service

    controller-->>manager: Response (200 OK)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
