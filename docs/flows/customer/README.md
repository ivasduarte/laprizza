# Customer - Design Diagrams (Mermaid)

The Customer aggregate manages customers: registration, listing and search, and updates.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (3 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Register Customer](./register-customer.md) | `POST /customers` | MANAGER | 201 Created | `register-customer.puml` |
| [UC2 - List and Search Customers](./list-search-customer.md) | `GET /customers?search={term}` | MANAGER | 200 OK | `list-search-customer.puml` |
| [UC4 - Update Customer](./update-customer.md) | `PATCH /customers/:id` | MANAGER | 200 OK | `update-customer.puml` |

## Business rules shown in the diagrams

- On registration the domain validates the address through the external postal code validator (the postal code must match the city) and normalizes the phone number.
- The email and the phone number must be unique, otherwise the request fails with 409.
- Updates are partial. The address and the phone number are validated again only when they are provided.
- All operations are restricted to Manager.

## Notation key

| Notation | Meaning |
|---|---|
| Actor (stick figure) | Person using the system, with the role shown in the label |
| Shaded box "Back-end API" | System boundary of the container (Node.js, Express) that holds all the components |
| Shaded box "External System" | System outside the Back-end API boundary |
| Participant label | `Name`, followed by `[Type: technology]` |
| Solid arrow | Call or request |
| Dashed arrow | Return value or response |
| Arrow to the same participant | Work done inside that component |
| Number on an arrow | Order of the interaction (autonumber) |
| `alt` / `else` frame | Alternative flows, only one of them runs |
| `opt` frame | Optional flow, runs only if the condition holds |

## Element catalogue

| Element | Type | Technology | Responsibility | Used in |
|---|---|---|---|---|
| Manager | Person | - | Back-office user with the MANAGER role | All diagrams |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| CustomersController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| CustomersService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| CustomersDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC1 - Register Customer](./register-customer.md), [UC4 - Update Customer](./update-customer.md) |
| CustomersRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| PostalCodeValidator | External System | - | Checks that a postal code matches a city | [UC1 - Register Customer](./register-customer.md), [UC4 - Update Customer](./update-customer.md) |

## Conversion notes

- The external `PostalCodeValidator` is drawn in its own "External System" box at the right edge, so the call from the domain crosses the repository lifeline.
- The route participant is called "Route (Joi & RBAC)" in every diagram.
