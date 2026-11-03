# Pizza Component Configuration - Design Diagrams (Mermaid)

The Pizza Component Configuration aggregate manages the configuration of a pizza component for each pizza size (the price and the stock units consumed). In the diagrams it is called Component Size Configuration and it is stored inside the product.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (4 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Component Size Configuration](./create-component-size-configuration.md) | `POST /products/{productId}/size-configurations` | MANAGER | 201 Created | `create-component-size-configuration-design.puml` |
| [UC2 - List and Search Component Size Configurations](./list-search-component-size-configuration.md) | `GET /products/{productId}/size-configurations` | MANAGER, EMPLOYEE | 200 OK | `list-search-component-size-configuration-design.puml` |
| [UC3 - Update Component Size Configuration](./update-component-size-configuration.md) | `PUT /products/{productId}/size-configurations/{sizeId}` | MANAGER | 200 OK | `update-component-size-configuration-design.puml` |
| [UC4 - Remove Component Size Configuration](./remove-component-size-configuration.md) | `DELETE /products/{productId}/size-configurations/{sizeId}` | MANAGER | 200 OK | `remove-component-size-configuration-design.puml` |

## Business rules shown in the diagrams

- The product must be a pizza component and must be active, and the pizza size must exist and be active.
- A size can be configured only once per product.
- The stock units consumed are normalized and validated against the `stockControlled` flag of the product.
- Listing and consulting are open to Manager and Employee. Create, update and remove are restricted to Manager.

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
| Employee | Person | - | Back-office user with the EMPLOYEE role | [UC2 - List and Search Component Size Configurations](./list-search-component-size-configuration.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| ComponentSizeConfigurationController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| ComponentSizeConfigurationService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| ComponentSizeConfigurationDomain | Component | Node.js module | Validation and normalization rules of the domain | All diagrams |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| PizzaSizeRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC1 - Create Component Size Configuration](./create-component-size-configuration.md) |

## Conversion notes

- The folder follows the aggregate name, while the diagrams and use cases keep the original name "Component Size Configuration".
- The repository that holds the configurations is `ProductsRepository`, because the configurations are part of the product.
