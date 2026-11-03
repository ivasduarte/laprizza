# UC2 - List and Search Product Categories

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /product-categories?name, GET /product-categories/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager lists the active product categories, searches them by exact name (active or inactive), or consults a single category by id.

## Diagram

```mermaid
---
title: "UC2 - List and Search Product Categories - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductCategoriesController<br/>[Component: Controller]
        participant service as ProductCategoriesService<br/>[Component: Service]
        participant repo as ProductCategoriesRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: GET /product-categories?name<br/>or GET /product-categories/{id}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Query / Id format (Joi)

    alt List / Search
      route->>controller: list(req, res, next)
      activate controller
      controller->>service: listProductCategories(name, repo)
      activate service

      alt Without name
        service->>repo: listProductCategories()
        activate repo
        repo-->>service: Active ProductCategory Entities
        deactivate repo
      else With name
        service->>repo: searchByName(name)
        activate repo
        repo-->>service: ProductCategory Entities (active or inactive, exact name)
        deactivate repo
      end

      service->>service: toProductCategoryDTO(each)
      service-->>controller: ProductCategory DTO list
      deactivate service
      controller-->>manager: Response (200 OK)
      deactivate controller
    else Consult by id
      route->>controller: getById(req, res, next)
      activate controller
      controller->>service: getProductCategoryById(id, repo)
      activate service
      service->>repo: findById(id)
      activate repo
      repo-->>service: ProductCategory Entity
      deactivate repo

      service->>service: toProductCategoryDTO(ProductCategory)
      service-->>controller: ProductCategory DTO
      deactivate service
      controller-->>manager: Response (200 OK)
      deactivate controller
    end

    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
