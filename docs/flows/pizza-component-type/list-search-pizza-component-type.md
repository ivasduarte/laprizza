# UC2 - List and Search Pizza Component Types

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /pizza-component-type?name, GET /pizza-component-type/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | Happy path only |

## Description

A Manager lists the active pizza component types (sorted by assembly order), searches them by exact name (active or inactive), or consults a single type by id.

## Diagram

```mermaid
---
title: "UC2 - List and Search Pizza Component Types - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PizzaComponentTypeController<br/>[Component: Controller]
        participant service as PizzaComponentTypeService<br/>[Component: Service]
        participant repo as PizzaComponentTypeRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: GET /pizza-component-type?name<br/>or GET /pizza-component-type/{id}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Query / Id format (Joi)

    alt List / Search
      route->>controller: list(req, res, next)
      activate controller
      controller->>service: listPizzaComponentTypes(name, repo)
      activate service

      alt Without name
        service->>repo: listPizzaComponentTypes()
        activate repo
        repo-->>service: Active PizzaComponentType Entities (sorted by assembly order)
        deactivate repo
      else With name
        service->>repo: searchByName(name)
        activate repo
        repo-->>service: PizzaComponentType Entities (active or inactive, exact name)
        deactivate repo
      end

      service->>service: toPizzaComponentTypeDTO(each)
      service-->>controller: PizzaComponentType DTO list
      deactivate service
      controller-->>manager: Response (200 OK)
      deactivate controller
    else Consult by id
      route->>controller: getById(req, res, next)
      activate controller
      controller->>service: getPizzaComponentTypeById(id, repo)
      activate service
      service->>repo: findById(id)
      activate repo
      repo-->>service: PizzaComponentType Entity
      deactivate repo

      service->>service: toPizzaComponentTypeDTO(PizzaComponentType)
      service-->>controller: PizzaComponentType DTO
      deactivate service
      controller-->>manager: Response (200 OK)
      deactivate controller
    end

    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
