# UC4 - Update Product

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /products/:id` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 404 (product or referenced entity not found or inactive), 409 (deactivation with size configurations, or duplicated name), 400 (sellable product with invalid price) |

## Description

A Manager partially updates a product. Name and description are re-validated by the domain, a product with size configurations cannot be deactivated, a sellable product needs a valid price, updated references must exist and be active, and a duplicated name results in a conflict error.

## Diagram

```mermaid
---
title: "UC4 - Update Product - C4 Dynamic, Level 3 (Component)"
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
    end

    activate manager
    manager->>route: PATCH /products/:id { ...updates }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Object ID & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updateProduct(id, updateData, repos)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: Product Entity (or null)
    deactivate repo

    alt Product Not Found
      service-->>controller: AppError(404)
    else Product Found
      opt If name/description updated
        service->>domain: validate(...)
        activate domain
        domain-->>service: valid / DomainError
        deactivate domain
      end

      alt Deactivation rule violation (isActive: false but has sizeConfigurations)
        service-->>controller: AppError(409)
      else Sellable rule violation (sellable: true but invalid price)
        service-->>controller: AppError(400)
      else Rules satisfied
        opt If references updated
          service->>otherRepos: validateReferences
          activate otherRepos
          otherRepos-->>service: valid / null
          deactivate otherRepos
        end

        alt Referenced Entity Not Found / Inactive
          service-->>controller: AppError(404)
        else References valid
          service->>repo: update(id, mappedData)
          activate repo

          alt Duplicate Name
            repo-->>service: MongoError(11000)
            service-->>controller: AppError(409, "Duplicate Name")
          else Success
            repo-->>service: Updated Product Entity
            deactivate repo

            service->>service: toProductDTO(Product)
            service-->>controller: Product DTO
          end
        end
      end
    end

    deactivate service
    controller-->>manager: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
