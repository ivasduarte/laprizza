# UC4 - Consult Own Customer Data

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `GET /customers/me` |
| Allowed roles | CUSTOMER (`customers:read:own`) |
| Success response | 200 OK with the customer record linked to the session, `Cache-Control: no-store` |
| Error handling | 401 (no or invalid session), 403 `FORBIDDEN` (no `customers:read:own`), 404 `CUSTOMER_PROFILE_NOT_FOUND` (no linked customer); `GET /customers/{id}` answers 403 to a customer |
| ADRs | [ADR-0043](../../adr/0043-permission-based-authorization-matrix.md) |

## Description

A customer must never read another customer's personal data by changing a record reference or a request parameter. The endpoint for the customer's own data therefore has no parameter: the customer comes from the session.

1. **Guard.** `requirePermission("customers:read:own")` authenticates the request and checks the permission ([UC1](./access-protected-functionality.md)). The principal carries the `customerId` read from the user in the database, never from the token or the client.
2. **Ownership.** `CustomersService.getOwnCustomer(principal)` uses only `principal.customerId`. `canReadCustomer(principal, customerId)` accepts it with `customers:read`, or with `customers:read:own` and the same `customerId`. Without a linked customer the answer is `404 CUSTOMER_PROFILE_NOT_FOUND`, without querying the database.
3. **Answer.** 200 with the customer DTO and `Cache-Control: no-store`.

Trying another record through the generic endpoint, `GET /customers/{id}`, is refused by its guard (`customers:read`, Manager only) with `403 FORBIDDEN` and recorded as `ACCESS_DENIED`, whatever the id.

## Diagram

```mermaid
---
title: "UC4 - Consult Own Customer Data - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor customer as Customer<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Router<br/>[Component: Express router]
        participant guard as Authorization middleware<br/>[Component: requirePermission]
        participant controller as CustomersController<br/>[Component: Controller]
        participant service as CustomersService<br/>[Component: Service]
        participant ownership as Ownership rules<br/>[Component: Domain, pure functions]
        participant customers as CustomersRepository<br/>[Component: Repository, MongoDB]
        participant logger as SecurityLogger<br/>[Component: Node.js module]
    end

    activate customer
    alt Own data
        customer->>spa: Asks for their personal data
        activate spa
        spa->>route: GET /customers/me (Authorization: Bearer <access token>)
        activate route
        route->>guard: requirePermission("customers:read:own")
        activate guard
        guard->>guard: Authenticate and check the permission (UC1)
        guard->>controller: getMe(req, res, next)
        deactivate guard
        activate controller
        controller->>service: getOwnCustomer(principal)
        activate service
        alt No linked customer (principal.customerId is null)
            service-->>controller: AppError 404 CUSTOMER_PROFILE_NOT_FOUND
            controller-->>spa: 404
            spa-->>customer: "No customer profile"
        else Linked customer
            service->>ownership: canReadCustomer(principal, principal.customerId)
            ownership-->>service: true (customers:read:own and same customerId)
            service->>customers: findById(principal.customerId)
            activate customers
            customers-->>service: customer
            deactivate customers
            service-->>controller: customer DTO
            deactivate service
            controller-->>spa: 200 OK (Cache-Control: no-store)
            deactivate controller
            spa-->>customer: Own personal data
        end
        deactivate route
        deactivate spa
    else Another customer's record (changed reference)
        customer->>spa: Requests /customers/{another id}
        activate spa
        spa->>route: GET /customers/{id} (Authorization: Bearer <access token>)
        activate route
        route->>guard: requirePermission("customers:read")
        activate guard
        guard->>guard: Authenticate (UC1): permissions without customers:read
        guard->>logger: log(ACCESS_DENIED, { userId, roles, ip, method, path, route, required: customers:read, reason: MISSING_PERMISSION })
        guard-->>spa: 403 { error: { code: "FORBIDDEN" } }
        deactivate guard
        deactivate route
        spa-->>customer: "Access denied"
        deactivate spa
    end
    deactivate customer
```

See the [README](./README.md) for the notation key and the element catalogue.
