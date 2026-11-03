# UC1 - Register Customer

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Container | Back-end API |
| Endpoint | `POST /customers` |
| Allowed roles | MANAGER |
| Success response | 201 Created |
| Error handling | 400 (invalid address or phone number), 409 (email or phone number already in use) |

## Description

A Manager registers a customer. The domain validates the address using the external postal code validator and normalizes the phone number before the customer is persisted. A duplicated email or phone number results in a conflict error.

## Diagram

```mermaid
---
title: "UC1 - Register Customer - C4 Dynamic, Level 3 (Component)"
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
    manager->>route: POST /customers { name, email, phoneNumber, address, dietaryRestrictions }
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate Payload (Joi)
    route->>controller: create(req, res, next)
    activate controller

    controller->>service: createCustomer(data, repo, validator)
    activate service

    service->>domain: validateAddress(address, validator)
    activate domain
    domain->>validator: isValidMatch(postalCode, city)
    activate validator
    validator-->>domain: boolean
    deactivate validator
    domain-->>service: void / DomainError
    deactivate domain

    alt Invalid Address
      service-->>controller: AppError(400)
    else Valid Address
      service->>domain: normalizePhoneNumber(phoneNumber)
      activate domain
      domain-->>service: normalizedNumber / null
      deactivate domain

      alt Invalid Phone
        service-->>controller: AppError(400)
      else Valid Phone
        service->>repo: create({ ...data, phoneNumber })
        activate repo
        alt Duplicate Email/Phone
          repo-->>service: MongoError(11000)
          service-->>controller: AppError(409, "Email/Phone in use.")
        else Success
          repo-->>service: Customer Entity
          deactivate repo
          service->>service: toCustomerDto(Customer)
          service-->>controller: Customer DTO
        end
      end
    end
    deactivate service

    controller-->>manager: Response (201 Created or Error)
    deactivate controller
    deactivate route
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
