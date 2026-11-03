# UC3 - Consult Predefined Pizza by ID

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /predefined-pizzas/{id}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid id format), 404 (predefined pizza not found or inactive) |

## Description

A Manager or Employee consults the details of an active predefined pizza by its id. The service loads the product, sizes, components and component types and builds a details DTO with the components ordered by assembly order.

## Diagram

```mermaid
---
title: "UC3 - Consult Predefined Pizza by ID - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PredefinedPizzaController<br/>[Component: Controller]
        participant service as PredefinedPizzaService<br/>[Component: Service]
        participant repo as PredefinedPizzaRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user

    user->>route: GET /predefined-pizzas/{id}
    activate route

    route->>route: verifyToken → requireRole(MANAGER, EMPLOYEE) → validateId (24-char hex)

    alt Missing or invalid token
      route-->>user: 401 Unauthorized
    else Role not allowed
      route-->>user: 403 Forbidden
    else Invalid ID format
      route-->>user: 400 Bad Request ("Invalid ID format")
    else Request accepted
      route->>controller: getById(req, res, next, repo)
      activate controller

      controller->>service: getPredefinedPizzaById(id, repo)
      activate service

      service->>repo: findById(id)
      activate repo
      repo-->>service: PredefinedPizza (or null)
      deactivate repo

      alt Not found or inactive
        service-->>controller: AppError("Predefined Pizza not found.", 404)
      else Found
        service->>repo: findProductById + findSizesByIds + findProductsByIds + listComponentTypes
        activate repo
        repo-->>service: product, sizes, components, component types
        deactivate repo

        service->>service: toPredefinedPizzaDetailsDto(...)<br/>components ordered by assembly order
        service-->>controller: PredefinedPizzaDetailsDto
      end
      deactivate service

      controller-->>user: 200 OK (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
