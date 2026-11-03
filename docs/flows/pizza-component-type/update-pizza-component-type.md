# UC3 - Update Pizza Component Type

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PUT /pizza-component-type/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager updates a pizza component type. The domain normalizes and validates the input before the stored type is updated.

## Diagram

```mermaid
---
title: "UC3 - Update Pizza Component Type - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PizzaComponentTypeController<br/>[Component: Controller]
        participant service as PizzaComponentTypeService<br/>[Component: Service]
        participant domain as PizzaComponentTypeDomain<br/>[Component: Domain]
        participant repo as PizzaComponentTypeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: PUT /pizza-component-type/{id}<br/>{ name, assemblyOrder, minQuantity, maxQuantity }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Id & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updatePizzaComponentType(id, data, repo)
    activate service

    service->>domain: normalizeName(name) & normalizeMaxQuantity(maxQuantity)
    activate domain
    domain-->>service: normalizedName, normalizedMaxQuantity

    service->>domain: validateName, validateAssemblyOrder, validateMinQuantity,<br/>validateMaxQuantity & validateQuantityRange
    domain-->>service: valid
    deactivate domain

    service->>repo: findById(id)
    activate repo
    repo-->>service: PizzaComponentType Entity (active)

    service->>repo: update(id, typeData)
    repo-->>service: Updated PizzaComponentType Entity
    deactivate repo

    service->>service: toPizzaComponentTypeDTO(PizzaComponentType)
    service-->>controller: PizzaComponentType DTO
    deactivate service

    controller-->>manager: Response (200 OK)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
