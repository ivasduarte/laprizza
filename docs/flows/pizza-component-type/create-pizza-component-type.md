# UC1 - Create Pizza Component Type

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /pizza-component-type` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | Happy path only |

## Description

A Manager creates a pizza component type (name, assembly order, minimum and maximum quantity). The domain normalizes and validates the input before the type is persisted.

## Diagram

```mermaid
---
title: "UC1 - Create Pizza Component Type - C4 Dynamic, Level 3 (Component)"
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
    manager->>route: POST /pizza-component-type<br/>{ name, assemblyOrder, minQuantity, maxQuantity }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createPizzaComponentType(data, repo)
    activate service

    service->>domain: normalizeName(name) & normalizeMaxQuantity(maxQuantity)
    activate domain
    domain-->>service: normalizedName, normalizedMaxQuantity

    service->>domain: validateName, validateAssemblyOrder, validateMinQuantity,<br/>validateMaxQuantity & validateQuantityRange
    domain-->>service: valid
    deactivate domain

    service->>repo: create(typeData)
    activate repo
    repo-->>service: PizzaComponentType Entity
    deactivate repo

    service->>service: toPizzaComponentTypeDTO(PizzaComponentType)
    service-->>controller: PizzaComponentType DTO
    deactivate service

    controller-->>manager: Response (201 Created)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
