# UC5 - Update Predefined Pizza

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PUT /predefined-pizzas/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid id, body or configuration), 404 (predefined pizza not found or inactive) |

## Description

A Manager updates the sizes and/or the components of a predefined pizza. Fields that are not sent are taken from the stored pizza and the resulting configuration is validated again as a whole.

## Diagram

```mermaid
---
title: "UC5 - Update Predefined Pizza - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as PredefinedPizzaController<br/>[Component: Controller]
        participant service as PredefinedPizzaService<br/>[Component: Service]
        participant repo as PredefinedPizzaRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager

    manager->>route: PUT /predefined-pizzas/{id} {sizeIds?, componentIds?}
    activate route

    route->>route: verifyToken → requireRole(MANAGER) → validateId → Joi(at least one field)

    alt Missing or invalid token
      route-->>manager: 401 Unauthorized
    else Role is not MANAGER
      route-->>manager: 403 Forbidden
    else Invalid ID format or body (e.g. empty body, empty list)
      route-->>manager: 400 Bad Request
    else Request accepted
      route->>controller: update(req, res, next, repo)
      activate controller

      controller->>service: updatePredefinedPizza(id, data, repo)
      activate service

      service->>repo: findById(id)
      activate repo
      repo-->>service: PredefinedPizza (or null)
      deactivate repo

      alt Not found or inactive
        service-->>controller: AppError("Predefined Pizza not found.", 404)
      else Found
        service->>service: sizeIds / componentIds not sent are taken from the stored pizza
        service->>service: validateSizeIds + validateComponentIds [Domain]

        alt Lists repeated ids
          service-->>controller: AppError("Invalid Predefined Pizza: ...", 400)
        else Lists valid
          service->>repo: findSizesByIds + findProductsByIds + listComponentTypes
          activate repo
          repo-->>service: sizes, components, component types
          deactivate repo

          service->>service: validatePredefinedPizza(...) [Domain]

          alt Configuration invalid
            service-->>controller: AppError("Invalid Predefined Pizza: ...", 400)
          else Configuration valid
            service->>repo: update(id, {sizeIds, defaultConfiguration})
            activate repo
            repo-->>service: PredefinedPizza entity (updated)
            deactivate repo

            service->>service: toPredefinedPizzaDto(pizza)
            service-->>controller: PredefinedPizzaDto
          end
        end
      end
      deactivate service

      controller-->>manager: 200 OK (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
