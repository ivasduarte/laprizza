# UC2 - List and Search Predefined Pizzas

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /predefined-pizzas?name={name}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid query) |

## Description

A Manager or Employee lists the active predefined pizzas, optionally filtered by the name of the underlying product. An empty list is returned when nothing matches.

## Diagram

```mermaid
---
title: "UC2 - List and Search Predefined Pizzas - C4 Dynamic, Level 3 (Component)"
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

    user->>route: GET /predefined-pizzas?name={name}
    activate route

    route->>route: verifyToken → requireRole(MANAGER, EMPLOYEE) → Joi(query: name optional)

    alt Missing or invalid token
      route-->>user: 401 Unauthorized
    else Role not allowed
      route-->>user: 403 Forbidden
    else Invalid query (name empty or repeated)
      route-->>user: 400 Bad Request (Validation failed)
    else Request accepted
      route->>controller: list(req, res, next, repo)
      activate controller

      controller->>service: listPredefinedPizzas(filters, repo)
      activate service

      alt name filter present
        service->>repo: search(name)
        activate repo
        repo->>repo: products whose name contains the text,<br/>then their active Predefined Pizzas
        repo-->>service: PredefinedPizza[]
        deactivate repo
      else no filter
        service->>repo: list()
        activate repo
        repo-->>service: PredefinedPizza[] (active, by creation order)
        deactivate repo
      end

      service->>service: keep active pizzas + toPredefinedPizzaDto
      service-->>controller: PredefinedPizzaDto[] (empty if no match)
      deactivate service

      controller-->>user: 200 OK (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
