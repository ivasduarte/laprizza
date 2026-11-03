# Predefined Pizza - Design Diagrams (Mermaid)

The Predefined Pizza aggregate manages predefined pizzas: a sellable pizza product together with its available sizes and its default components.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (6 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Define Predefined Pizza](./define-predefined-pizza.md) | `POST /predefined-pizzas` | MANAGER | 201 Created | `define-predefined-pizza.puml` |
| [UC2 - List and Search Predefined Pizzas](./list-search-predefined-pizzas.md) | `GET /predefined-pizzas?name={name}` | MANAGER, EMPLOYEE | 200 OK | `list-search-predefined-pizzas.puml` |
| [UC3 - Consult Predefined Pizza by ID](./consult-predefined-pizza-by-id.md) | `GET /predefined-pizzas/{id}` | MANAGER, EMPLOYEE | 200 OK | `consult-predefined-pizza-by-id.puml` |
| [UC4 - Consult Predefined Pizza by Name](./consult-predefined-pizza-by-name.md) | `GET /predefined-pizzas/name/{name}` | MANAGER, EMPLOYEE | 200 OK | `consult-predefined-pizza-by-name.puml` |
| [UC5 - Update Predefined Pizza](./update-predefined-pizza.md) | `PUT /predefined-pizzas/{id}` | MANAGER | 200 OK | `update-predefined-pizza.puml` |
| [UC6 - Deactivate Predefined Pizza](./deactivate-predefined-pizza.md) | `PUT /predefined-pizzas/{id}` | MANAGER | 200 OK | `deactivate-predefined-pizza-design.puml` |

## Business rules shown in the diagrams

- Only one predefined pizza is allowed per product (unique `productId`, otherwise 409).
- The product must exist, be active, be sellable and must not be a pizza component. The lists of size ids and component ids must not repeat ids.
- The whole configuration is validated: sizes exist and are active, components exist, are active and have a type, the minimum and maximum quantity of each component type is respected and every component has a size configuration for every size.
- An update takes the sizes and components that were not sent from the stored pizza and validates the result again. Deactivation is the only other change supported (`isActive` must be false).
- Consulting returns a details DTO with the components ordered by assembly order, by id or by the exact name of the product. Listing returns active predefined pizzas and can be filtered by product name.
- Read operations are open to Manager and Employee. Define, update and deactivate are restricted to Manager.

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
| Employee | Person | - | Back-office user with the EMPLOYEE role | [UC2 - List and Search Predefined Pizzas](./list-search-predefined-pizzas.md), [UC3 - Consult Predefined Pizza by ID](./consult-predefined-pizza-by-id.md), [UC4 - Consult Predefined Pizza by Name](./consult-predefined-pizza-by-name.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | All diagrams |
| PredefinedPizzaController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| PredefinedPizzaService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| PredefinedPizzaRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- The route participant is called "Route (Joi & RBAC)" in every diagram (the originals called it "Route (Joi)").
- These diagrams have no Domain participant. The domain rules appear as self-calls marked `[Domain]` on the service, as in the original.
