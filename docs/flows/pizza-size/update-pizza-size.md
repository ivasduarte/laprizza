# UC4 - Update Pizza Size

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /pizza-size/:id` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 404 (pizza size not found), 409 (size in use or name already in use), 400 (invalid name) |

## Description

A Manager partially updates a pizza size. Deactivating a size is rejected while product size configurations still use it, a new name is validated by the domain and a duplicated name results in a conflict error.

## Diagram

```mermaid
---
title: "UC4 - Update Pizza Size - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PizzaSizeController<br/>[Component: Controller]
        participant service as PizzaSizeService<br/>[Component: Service]
        participant domain as PizzaSizeDomain<br/>[Component: Domain]
        participant prodRepo as ProductsRepository<br/>[Component: Repository, MongoDB/Dummy]
        participant repo as PizzaSizeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: PATCH /pizza-size/:id { ...updates }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Object ID & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updateSize(id, data, repo, prodRepo)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: PizzaSize Entity (or null)
    deactivate repo

    alt Pizza Size Not Found
      service-->>controller: AppError(404)
    else Pizza Size Found
      opt If isActive is being set to false
        service->>prodRepo: existsWithSizeConfigurationForPizzaSize(id)
        activate prodRepo
        prodRepo-->>service: boolean
        deactivate prodRepo
      end

      alt Is in use (deactivation attempted)
        service-->>controller: AppError(409, "Pizza size has size configurations...")
      else Validation Passed
        opt If name is being updated
          service->>domain: validatePizzaSize(data.name)
          activate domain
          domain-->>service: normalizedName / DomainError
          deactivate domain
        end

        alt Domain Validation Failed
          service-->>controller: AppError(400)
        else Update allowed
          service->>repo: update(id, mappedData)
          activate repo
          alt Duplicate Name
            repo-->>service: MongoError(11000)
            service-->>controller: AppError(409, "Pizza size already in use.")
          else Success
            repo-->>service: Updated PizzaSize Entity
            deactivate repo
            service->>service: toSizeDto(PizzaSize)
            service-->>controller: PizzaSize DTO
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
