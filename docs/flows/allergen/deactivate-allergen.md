# UC5 - Deactivate Allergen

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PUT /allergens/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 401 (invalid token), 403 (role not allowed), 400 (invalid id, body or isActive not false), 404 (allergen not found or already inactive), 409 (allergen still referenced) |

## Description

A Manager deactivates an allergen. Only deactivation is supported (isActive must be false) and an allergen that is still referenced by products or by customer dietary restrictions cannot be deactivated.

## Diagram

```mermaid
---
title: "UC5 - Deactivate Allergen - C4 Dynamic, Level 3 (Component)"
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

    manager->>route: PUT /allergens/{id} {isActive: false}
    activate route

    route->>route: verifyToken → requireRole(MANAGER) → validateId → Joi(isActive must be false)

    alt Missing or invalid token
      route-->>manager: 401 Unauthorized
    else Role is not MANAGER
      route-->>manager: 403 Forbidden
    else Invalid ID format or body (e.g. {name} or {isActive: true})
      route-->>manager: 400 Bad Request
    else Request accepted
      route->>controller: update(req, res, next, repo)
      activate controller

      controller->>service: updateAllergen(id, data, repo)
      activate service

      alt isActive is not false (defensive re-check)
        service-->>controller: AppError("Only deactivation is supported: isActive must be false.", 400)
      else isActive is false
        service->>repo: findById(id)
        activate repo
        repo-->>service: Allergen (or null)
        deactivate repo

        alt Not found or already inactive
          service-->>controller: AppError("Allergen not found.", 404)
        else Found
          service->>repo: isReferenced(id)
          activate repo
          repo->>repo: exists in Products.allergenIds or<br/>Customers.dietaryRestrictions.allergenIds
          repo-->>service: true / false
          deactivate repo

          alt Referenced by products or customers
            service-->>controller: AppError("Allergen is referenced ... cannot be deactivated.", 409)
          else Not referenced
            service->>repo: update(id, {isActive: false})
            activate repo
            repo-->>service: Allergen entity (inactive)
            deactivate repo

            service->>service: toAllergenDto(allergen)
            service-->>controller: AllergenDto {id, name, isActive: false}
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
