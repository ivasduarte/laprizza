# User - Design Diagrams (Mermaid)

The User aggregate manages the application users after they are registered: consultation, listing and updates by an Administrator.

> Since AA06 every operation on users belongs to the `ADMINISTRATOR` role, and roles, role history and activation invitations have their own endpoints: see [Role Assignment and Activation Invitation (AA06)](../authentication/role-assignment-and-invitations.md). The diagrams below keep the Sprint 1 participants.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (3 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [Get User](./get-user.md) | `GET /users/:id` | ADMINISTRATOR | 200 OK | `get.puml` |
| [List Users](./list-users.md) | `GET /users` | ADMINISTRATOR | 200 OK | `list.puml` |
| [UC3 - Update User](./update-user.md) | `PATCH /users/:id` | ADMINISTRATOR | 200 OK | `update.puml` |

## Business rules shown in the diagrams

- All operations are restricted to Administrator (AA06; Manager until AA05).
- Nobody changes the status or the roles of their own account (403).
- An account that was never activated cannot be enabled here (409 `ACTIVATION_REQUIRED`); disabling revokes the sessions and the pending invitations.
- A new password is validated by the domain and hashed with Argon2.
- When the role of a user changes away from CUSTOMER, the customer reference is cleared.

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
| UsersController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | All diagrams |
| UsersService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| UsersDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC3 - Update User](./update-user.md) |
| UsersRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- "Get User" and "List Users" have no use case number in the originals (`get.puml` and `list.puml`), so they have none here either.
- `list.puml` was already written in Mermaid and was rebuilt in the same format as the other diagrams.
