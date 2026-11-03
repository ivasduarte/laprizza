# Pizza Size - Design Diagrams (Mermaid)

The Pizza Size aggregate manages the sizes in which pizzas are offered.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (4 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Pizza Size](./create-pizza-size.md) | `POST /pizza-size` | MANAGER | 201 Created | `create-pizza-size.puml` |
| [UC3 - Get Pizza Size](./get-pizza-size.md) | `GET /pizza-size/:id` | MANAGER | 200 OK | `get-pizza-size.puml` |
| [UC2 - List and Search Pizza Sizes](./list-search-pizza-size.md) | `GET /pizza-size?search={term}` | MANAGER | 200 OK | `list-search-pizza-size.puml` |
| [UC4 - Update Pizza Size](./update-pizza-size.md) | `PATCH /pizza-size/:id` | MANAGER | 200 OK | `update-pizza-size.puml` |

## Business rules shown in the diagrams

- The name is validated and normalized by the domain and must be unique, otherwise the request fails with 409.
- A pizza size cannot be deactivated (409) while product size configurations still use it.
- A renamed size is validated again by the domain.
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
| PizzaSizeController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| PizzaSizeService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| PizzaSizeDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC1 - Create Pizza Size](./create-pizza-size.md), [UC4 - Update Pizza Size](./update-pizza-size.md) |
| PizzaSizeRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC4 - Update Pizza Size](./update-pizza-size.md) |

## Conversion notes

- The empty `else` branch of "Update Pizza Size" was labelled "Update allowed".
