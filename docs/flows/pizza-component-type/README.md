# Pizza Component Type - Design Diagrams (Mermaid)

The Pizza Component Type aggregate manages the types of pizza components, each with a name, an assembly order and a minimum and maximum quantity. Predefined pizzas are validated against these limits.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (4 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Create Pizza Component Type](./create-pizza-component-type.md) | `POST /pizza-component-type` | MANAGER | 201 Created | `create-pizza-component-type-design.puml` |
| [UC2 - List and Search Pizza Component Types](./list-search-pizza-component-type.md) | `GET /pizza-component-type?name` | MANAGER | 200 OK | `list-search-pizza-component-type-design.puml` |
| [UC3 - Update Pizza Component Type](./update-pizza-component-type.md) | `PUT /pizza-component-type/{id}` | MANAGER | 200 OK | `update-pizza-component-type-design.puml` |
| [UC4 - Remove Pizza Component Type](./remove-pizza-component-type.md) | `DELETE /pizza-component-type/{id}` | MANAGER | 204 No Content | `remove-pizza-component-type-design.puml` |

## Business rules shown in the diagrams

- The domain normalizes the name and the maximum quantity, and validates the name, the assembly order, the quantities and the quantity range.
- Listing returns the active types sorted by assembly order. Searching by exact name returns active and inactive types, and a type can also be consulted by id.
- Removal is logical (`isActive` is set to false) after checking that no active product uses the type.
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
| PizzaComponentTypeController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| PizzaComponentTypeService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| PizzaComponentTypeDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC1 - Create Pizza Component Type](./create-pizza-component-type.md), [UC3 - Update Pizza Component Type](./update-pizza-component-type.md) |
| PizzaComponentTypeRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |
| ProductsRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | [UC4 - Remove Pizza Component Type](./remove-pizza-component-type.md) |

## Conversion notes

- In "List and Search Pizza Component Types" the repository activation is opened and closed inside each branch, while the original left it open across the `alt` frame.
