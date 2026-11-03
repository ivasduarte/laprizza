# Allergen - Design Diagrams (Mermaid)

The Allergen aggregate manages the allergens that products reference and that customers can declare as dietary restrictions. Allergens are deactivated instead of removed.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (5 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Allergen](./create-allergen.md) | `POST /allergens` | MANAGER | 201 Created | `create-allergen.puml` |
| [UC2 - List and Search Allergens](./list-search-allergens.md) | `GET /allergens?name={name}` | MANAGER, EMPLOYEE | 200 OK | `list-search-allergens.puml` |
| [UC3 - Consult Allergen by ID](./consult-allergen-by-id.md) | `GET /allergens/{id}` | MANAGER, EMPLOYEE | 200 OK | `consult-allergen-by-id.puml` |
| [UC4 - Consult Allergen by Name](./consult-allergen-by-name.md) | `GET /allergens/name/{name}` | MANAGER, EMPLOYEE | 200 OK | `consult-allergen-by-name.puml` |
| [UC5 - Deactivate Allergen](./deactivate-allergen.md) | `PUT /allergens/{id}` | MANAGER | 200 OK | `deactivate-allergen.puml` |

## Business rules shown in the diagrams

- The name is validated by the domain, trimmed and must be unique (case-insensitive unique index), otherwise the request fails with 409.
- Consult and list operations only return active allergens. Listing is sorted by name, searching by name is a partial, case-insensitive match and consulting by name is an exact, case-insensitive match.
- Deactivation is the only supported update (`isActive` must be false). An allergen that is still referenced by products or by customer dietary restrictions cannot be deactivated (409).
- Read operations are open to Manager and Employee. Create and deactivate are restricted to Manager.

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
| Employee | Person | - | Back-office user with the EMPLOYEE role | [UC2 - List and Search Allergens](./list-search-allergens.md), [UC3 - Consult Allergen by ID](./consult-allergen-by-id.md), [UC4 - Consult Allergen by Name](./consult-allergen-by-name.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| AllergenController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| AllergenService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| AllergenRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- The route participant is called "Route (Joi & RBAC)" in every diagram (the originals called it "Route (Joi)").
- "Create Allergen" has no Domain participant. The domain rule appears as a self-call marked `[Domain]` on the service, as in the original.
