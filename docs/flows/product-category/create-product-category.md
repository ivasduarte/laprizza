# UC1 - Create Product Category

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /product-category` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | Happy path only |

## Description

A Manager creates a product category. The domain normalizes and validates the name before the category is persisted.

## Diagram

```mermaid
---
title: "UC1 - Create Product Category - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductCategoryController<br/>[Component: Controller]
        participant service as ProductCategoryService<br/>[Component: Service]
        participant domain as ProductCategoryDomain<br/>[Component: Domain]
        participant repo as ProductCategoryRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: POST /product-category { name }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createProductCategory(data, repo)
    activate service

    service->>domain: normalizeName(data.name) & validateName(name)
    activate domain
    domain-->>service: normalizedName
    deactivate domain

    service->>repo: create(categoryData)
    activate repo
    repo-->>service: ProductCategory Entity
    deactivate repo

    service->>service: toproductCategoryDto(ProductCategory)
    service-->>controller: ProductCategory DTO
    deactivate service

    controller-->>manager: Response (201 Created or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
