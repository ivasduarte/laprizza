# UC3 - Update User

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /users/:id` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 403 (manager changing own role or status), 404 (user not found) |

## Description

A Manager partially updates a user (status, role and/or password). A Manager cannot change the status or role of their own account. A new password is validated by the domain and hashed with Argon2, and the customer reference is cleared when the role changes away from CUSTOMER.

## Diagram

```mermaid
---
title: "UC3 - Update User - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as UsersController<br/>[Component: Controller]
        participant service as UsersService<br/>[Component: Service]
        participant domain as UsersDomain<br/>[Component: Domain]
        participant repo as UsersRepository<br/>[Component: Repository, MongoDB/Dummy]
    end

    activate manager
    manager->>route: PATCH /users/:id {isActive, role, password}
    activate route

    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Object ID & Payload
    route->>controller: update(req, res, next)
    activate controller

    alt Manager updating own account status/role
      controller-->>manager: AppError(403, "Cannot change own role/status")
    else Valid target
      controller->>service: updateUser(id, updateData, repository)
      activate service

      service->>repo: findById(id)
      activate repo
      repo-->>service: User Entity (or null)
      deactivate repo

      alt User Not Found
        service-->>controller: AppError(404)
      else Found
        opt If password is provided
          service->>domain: validatePasswordStrength(password)
          activate domain
          domain-->>service: void
          deactivate domain
          service->>service: Argon2 hash(password)
        end
        opt If role changed from CUSTOMER
          service->>service: Set customerId = null
        end

        service->>repo: update(id, mappedData)
        activate repo
        repo-->>service: Updated User Entity
        deactivate repo

        service->>service: toUserDto(User)
        service-->>controller: User DTO
      end
      deactivate service

      controller-->>manager: Response (200 OK or Error)
    end
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
