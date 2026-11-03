# UC1 - Create Product

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /products` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 400 (sellable product without a valid price), 404 (referenced entity not found or inactive), 409 (product name already exists) |

## Description

A Manager creates a product. The domain validates the name and description, a sellable product needs a valid price, and the referenced categories, types and allergens must exist and be active. The name must be unique and, for stock-controlled products, an initial stock record with quantity 0 is created.

## Diagram

```mermaid
---
title: "UC1 - Create Product - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as ProductsController<br/>[Component: Controller]
        participant service as ProductsService<br/>[Component: Service]
        participant domain as ProductsDomain<br/>[Component: Domain]
        participant otherRepos as OtherRepositories<br/>(Categories, Allergens, Types)<br/>[Component: Repository, MongoDB/Dummy]
        participant repo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
        participant stockRepo as StockRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: POST /products<br/>{ name, description, sellable, stockControlled, categoryId... }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createProduct(data, repos)
    activate service

    service->>domain: validateProductName & validateProductDescription
    activate domain
    domain-->>service: valid
    deactivate domain

    alt sellable is true but price is negative or missing
      service-->>controller: AppError(400)
    else Price valid
      service->>otherRepos: validateReferences (Categories, Types, Allergens)
      activate otherRepos
      otherRepos-->>service: Entities (or null)
      deactivate otherRepos

      alt Referenced Entity Not Found / Inactive
        service-->>controller: AppError(404)
      else References valid
        service->>repo: findByName(data.name)
        activate repo
        repo-->>service: Product Entity (or null)
        deactivate repo

        alt Duplicate Name
          service-->>controller: AppError(409, "A product with this name already exists")
        else Success
          service->>repo: create(data)
          activate repo
          repo-->>service: New Product Entity
          deactivate repo

          opt If stockControlled is true
            service->>stockRepo: create({ productId, quantity: 0 })
            activate stockRepo
            stockRepo-->>service: Stock Entity
            deactivate stockRepo
          end

          service->>service: toProductDTO(Product)
          service-->>controller: Product DTO
        end
      end
    end

    deactivate service
    controller-->>manager: Response (201 Created or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
