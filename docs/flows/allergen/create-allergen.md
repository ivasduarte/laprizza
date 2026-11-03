# UC1 - Create Allergen

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /allergens` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid payload or name), 409 (name already in use) |

## Description

A Manager creates an allergen. The name is validated by the domain rules and trimmed, and a case-insensitive unique index rejects duplicated names, which the service translates into a conflict error.

## Diagram

```mermaid
---
title: "UC1 - Create Allergen - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as AllergenController<br/>[Component: Controller]
        participant service as AllergenService<br/>[Component: Service]
        participant repo as AllergenRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager

    manager->>route: POST /allergens {name}
    activate route

    route->>route: verifyToken → requireRole(MANAGER) → Joi(name)

    alt Missing or invalid token
      route-->>manager: 401 Unauthorized
    else Role is not MANAGER
      route-->>manager: 403 Forbidden
    else Invalid payload (name missing, empty or not a string)
      route-->>manager: 400 Bad Request (Validation failed)
    else Request accepted
      route->>controller: create(req, res, next, repo)
      activate controller

      controller->>service: createAllergen(data, repo)
      activate service

      service->>service: validateAllergenName(name) [Domain]

      alt Name rejected by domain
        service-->>controller: AppError("Invalid Allergen: ...", 400)
      else Name valid (trimmed)
        service->>repo: create({name, isActive: true})
        activate repo
        repo-->>service: Allergen entity (or Error 11000)
        deactivate repo

        alt Duplicate name (unique index, case-insensitive)
          service-->>controller: AppError("Allergen name already in use.", 409)
        else Created
          service->>service: toAllergenDto(allergen)
          service-->>controller: AllergenDto {id, name, isActive}
        end
      end
      deactivate service

      controller-->>manager: 201 Created (or error via next(error))
      deactivate controller
    end

    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
