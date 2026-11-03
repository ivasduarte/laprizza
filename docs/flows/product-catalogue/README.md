# Product Catalogue - Design Diagrams (Mermaid)

The Product Catalogue aggregate is the read-only, customer-facing view of the products. Only active and sellable products are exposed.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (2 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - List and Search Catalogue](./list-search-catalogue.md) | `GET /catalogue?search={term}&categoryId={id}` | CUSTOMER, MANAGER, EMPLOYEE | 200 OK | `list-search-catalogue.puml` |
| [UC2 - Get Catalogue Item](./get-catalogue-item.md) | `GET /catalogue/:id` | CUSTOMER, MANAGER, EMPLOYEE | 200 OK | `get-catalogue-item.puml` |

## Business rules shown in the diagrams

- The service always restricts the listing to active and sellable products.
- Consulting an item that does not exist, is inactive or is not sellable fails with 404.
- Both operations are open to Customer, Manager and Employee.

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
| Customer | Person | - | End user with the CUSTOMER role | All diagrams |
| Manager | Person | - | Back-office user with the MANAGER role | All diagrams |
| Employee | Person | - | Back-office user with the EMPLOYEE role | All diagrams |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| CatalogueController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| CatalogueService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- The condition "isActive === false OR sellable === false" was written in words ("inactive or not sellable").
