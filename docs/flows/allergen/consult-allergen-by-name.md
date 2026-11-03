# UC4 - Consult Allergen by Name

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `GET /allergens/name/{name}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid name), 404 (allergen not found or inactive) |

## Description

A Manager or Employee consults a single active allergen by its exact name (case-insensitive).

## Diagram

```mermaid
---
title: "UC4 - Consult Allergen by Name - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as AllergenController<br/>[Component: Controller]
        participant service as AllergenService<br/>[Component: Service]
        participant repo as AllergenRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate user

    user->>route: GET /allergens/name/{name}
    activate route

    route->>route: verifyToken → requireRole(MANAGER, EMPLOYEE) → Joi(params: name required)

    alt Missing or invalid token
      route-->>user: 401 Unauthorized
    else Role not allowed
      route-->>user: 403 Forbidden
    else Invalid name parameter
      route-->>user: 400 Bad Request (Validation failed)
    else Request accepted
      route->>controller: getByName(req, res, next, repo)
      activate controller

      controller->>service: getAllergenByName(name, repo)
      activate service

      service->>repo: findByName(name)
      activate repo
      repo-->>service: Allergen (or null) (exact match, case-insensitive)
      deactivate repo

      alt Not found or inactive
        service-->>controller: AppError("Allergen not found.", 404)
      else Found
        service->>service: toAllergenDto(allergen)
        service-->>controller: AllergenDto {id, name, isActive}
      end
      deactivate service

      controller-->>user: 200 OK (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
