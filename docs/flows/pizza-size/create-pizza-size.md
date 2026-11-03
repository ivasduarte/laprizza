# UC1 - Create Pizza Size

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /pizza-size` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 400 (invalid name), 409 (name already in use) |

## Description

A Manager creates a pizza size. The domain validates and normalizes the name and the repository rejects duplicated names, which the service translates into a conflict error.

## Diagram

```mermaid
---
title: "UC1 - Create Pizza Size - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PizzaSizeController<br/>[Component: Controller]
        participant service as PizzaSizeService<br/>[Component: Service]
        participant domain as PizzaSizeDomain<br/>[Component: Domain]
        participant repo as PizzaSizeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: POST /pizza-size { name }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createSize(data, repo)
    activate service

    service->>domain: validatePizzaSize(data.name)
    activate domain

    alt Invalid Name
      domain-->>service: DomainError
      service-->>controller: AppError(400)
    else Valid Name
      domain-->>service: normalizedName
      deactivate domain

      service->>repo: create(sizeData)
      activate repo

      alt Duplicate Name
        repo-->>service: MongoError(11000)
        service-->>controller: AppError(409, "Pizza size already in use.")
      else Success
        repo-->>service: PizzaSize Entity
        deactivate repo
        service->>service: toSizeDto(PizzaSize)
        service-->>controller: PizzaSize DTO
      end
    end
    deactivate service

    controller-->>manager: Response (201 Created or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
