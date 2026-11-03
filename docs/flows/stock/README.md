# Stock - Design Diagrams (Mermaid)

The Stock aggregate manages the stock quantity of stock-controlled products.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (3 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC2 - Get Stock](./get-stock.md) | `GET /stock/:productId` | MANAGER, EMPLOYEE | 200 OK | `get-stock.puml` |
| [UC1 - List and Search Stock](./list-search-stock.md) | `GET /stock?search={term}` | MANAGER, EMPLOYEE | 200 OK | `list-search-stock.puml` |
| [UC3 - Adjust Stock](./adjust-stock.md) | `PATCH /stock/:productId` | MANAGER, EMPLOYEE | 200 OK | `update-stock.puml` |

## Business rules shown in the diagrams

- Only stock-controlled products have stock, otherwise the request fails with 400.
- When a product has no stock record yet, one is created with quantity 0 the first time the stock is consulted or adjusted.
- Adjusting the stock increases or decreases the quantity by the given amount, and an operation that would leave a negative quantity is rejected (400).
- All operations are open to Manager and Employee.

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
| Employee | Person | - | Back-office user with the EMPLOYEE role | All diagrams |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| StockController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| StockService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| StockDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC3 - Adjust Stock](./adjust-stock.md) |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC2 - Get Stock](./get-stock.md), [UC3 - Adjust Stock](./adjust-stock.md) |
| StockRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- "Adjust Stock" was converted from `update-stock.puml` (its title is `UC3_Adjust_Stock_Design`) and the file is named after the use case.
- Comparisons such as `newQuantity < 0` and `operation === 'increase'` were written in words.
