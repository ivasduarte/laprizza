# Product - Design Diagrams (Mermaid)

The Product aggregate manages products: creation, consultation, listing and search, and updates. A product references categories, allergens and types.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (4 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Product](./create-product.md) | `POST /products` | MANAGER | 201 Created | `create-product.puml` |
| [UC3 - Get Product](./get-product.md) | `GET /products/:id` | MANAGER, EMPLOYEE | 200 OK | `get-product.puml` |
| [UC2 - List and Search Products](./list-search-product.md) | `GET /products?search={term}&categoryId={id}` | MANAGER, EMPLOYEE | 200 OK | `list-search-product.puml` |
| [UC4 - Update Product](./update-product.md) | `PATCH /products/:id` | MANAGER | 200 OK | `update-product.puml` |

## Business rules shown in the diagrams

- The name and the description are validated by the domain, and the name must be unique (409).
- A sellable product needs a valid price (400).
- The referenced categories, allergens and types must exist and be active (404).
- A stock-controlled product gets an initial stock record with quantity 0 when it is created.
- A product that has size configurations cannot be deactivated (409).
- Read operations are open to Manager and Employee. Create and update are restricted to Manager.

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
| Employee | Person | - | Back-office user with the EMPLOYEE role | [UC3 - Get Product](./get-product.md), [UC2 - List and Search Products](./list-search-product.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| ProductsController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| ProductsService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| ProductsDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC1 - Create Product](./create-product.md), [UC4 - Update Product](./update-product.md) |
| OtherRepositories (Categories, Allergens, Types) | Component | MongoDB (production) or Dummy (tests) | Group of the category, allergen and type repositories, used to validate the references of a product | [UC1 - Create Product](./create-product.md), [UC4 - Update Product](./update-product.md) |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| StockRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC1 - Create Product](./create-product.md) |

## Conversion notes

- The repositories of categories, allergens and types are drawn as one participant, "OtherRepositories", as in the original.
- Empty `else` branches were labelled ("Price valid" and "References valid" in Create Product, "Rules satisfied" and "References valid" in Update Product) and comparisons such as `price < 0` were written in words.
