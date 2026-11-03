# UC4 - Update Customer

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `PATCH /customers/:id` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 404 (customer not found), 400 (invalid address or phone number), 409 (email or phone number already in use) |

## Description

A Manager partially updates a customer. The address and the phone number are validated again only when they are provided. A duplicated email or phone number results in a conflict error.

## Diagram

```mermaid
---
title: "UC4 - Update Customer - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as CustomersController<br/>[Component: Controller]
        participant service as CustomersService<br/>[Component: Service]
        participant domain as CustomersDomain<br/>[Component: Domain]
        participant repo as CustomersRepository<br/>[Component: Repository, MongoDB/Dummy]
    end
    box rgba(160,160,160,0.20) External System
        participant validator as PostalCodeValidator<br/>[External System]
    end

    activate manager
    manager->>route: PATCH /customers/:id { ...updates }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Object ID & Payload (Joi)
    route->>controller: update(req, res, next)
    activate controller

    controller->>service: updateCustomer(id, data, repo, validator)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: Customer Entity (or null)
    deactivate repo

    alt Customer Not Found
      service-->>controller: AppError(404)
    else Customer Found
      opt If address is provided
        service->>domain: validateAddress(address, validator)
        activate domain
        domain->>validator: isValidMatch(postalCode, city)
        activate validator
        validator-->>domain: boolean
        deactivate validator
        domain-->>service: void / DomainError
        deactivate domain
      end

      opt If phoneNumber is provided
        service->>domain: normalizePhoneNumber(phoneNumber)
        activate domain
        domain-->>service: normalizedNumber / null
        deactivate domain
      end

      alt Domain Validation Failed
        service-->>controller: AppError(400)
      else Validation Passed
        service->>repo: update(id, mappedData)
        activate repo
        alt Duplicate Email/Phone
          repo-->>service: MongoError(11000)
          service-->>controller: AppError(409, "Email/Phone in use.")
        else Success
          repo-->>service: Updated Customer Entity
          deactivate repo
          service->>service: toCustomerDto(Customer)
          service-->>controller: Customer DTO
        end
      end
    end
    deactivate service

    controller-->>manager: Response (200 OK or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
