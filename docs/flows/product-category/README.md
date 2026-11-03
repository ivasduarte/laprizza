# Product Category - Design Diagrams (Mermaid)

The Product Category aggregate manages the categories that products reference.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (4 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Product Category](./create-product-category.md) | `POST /product-category` | MANAGER | 201 Created | `create-product-category-design.puml` |
| [UC2 - List and Search Product Categories](./list-search-product-category.md) | `GET /product-categories?name` | MANAGER | 200 OK | `list-search-product-category-design.puml` |
| [UC3 - Update Product Category](./update-product-category.md) | `PUT /product-categories/{id}` | MANAGER | 200 OK | `update-product-categry-design.puml` |
| [UC4 - Remove Product Category](./remove-product-category.md) | `DELETE /product-categories/{id}` | MANAGER | 204 No Content | `remove-product-category-design.puml` |

## Business rules shown in the diagrams

- The domain normalizes and validates the name.
- Listing returns the active categories. Searching by exact name returns active and inactive categories, and a category can also be consulted by id.
- Removal is logical (`isActive` is set to false) after checking that no active product uses the category.
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
| ProductCategoryController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC1 - Create Product Category](./create-product-category.md) |
| ProductCategoriesController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC2 - List and Search Product Categories](./list-search-product-category.md), [UC3 - Update Product Category](./update-product-category.md), [UC4 - Remove Product Category](./remove-product-category.md) |
| ProductCategoryService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | [UC1 - Create Product Category](./create-product-category.md) |
| ProductCategoriesService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | [UC2 - List and Search Product Categories](./list-search-product-category.md), [UC3 - Update Product Category](./update-product-category.md), [UC4 - Remove Product Category](./remove-product-category.md) |
| ProductCategoryDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC1 - Create Product Category](./create-product-category.md) |
| ProductCategoriesDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC3 - Update Product Category](./update-product-category.md) |
| ProductCategoryRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC1 - Create Product Category](./create-product-category.md) |
| ProductCategoriesRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC2 - List and Search Product Categories](./list-search-product-category.md), [UC3 - Update Product Category](./update-product-category.md), [UC4 - Remove Product Category](./remove-product-category.md) |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC4 - Remove Product Category](./remove-product-category.md) |

## Conversion notes

- The original diagrams use `/product-category` for creation and `/product-categories` for the other operations. Each endpoint was kept as it is in its source diagram.
- "Create Product Category" calls `toproductCategoryDto` (lowercase p) in the source diagram. The name was kept.
- In "List and Search Product Categories" the repository activation is opened and closed inside each branch, while the original left it open across the `alt` frame.
