# Authentication - Design Diagrams (Mermaid)

The Authentication aggregate covers how a user proves their identity (login) and how a Manager registers new users.

Process View (SAD), Level 3, documented as C4 dynamic diagrams of the **Back-end API** container (2 diagrams). They were converted from the original PlantUML sequence diagrams.

## Diagrams

| Use case | Endpoint | Roles | Success | Original file |
|---|---|---|---|---|
| [UC1 - Login](./login.md) | `POST /auth/login` | Public (no authentication) | 200 OK (JWT token) | `login.puml` |
| [UC2 - Register User](./register-user.md) | `POST /users` | MANAGER | 201 Created | `register.puml` |

## Business rules shown in the diagrams

- Login is public. The user is found by email or username and the password is verified with Argon2.
- Every login failure returns the same generic 401, whether the user does not exist, is inactive or the password is wrong. A dummy Argon2 hash is computed when the user is not found, to mitigate timing attacks.
- A successful login returns a signed JWT.
- Registering a user is restricted to Manager. The domain validates the password strength, the service hashes the password with Argon2 and a duplicated email or username results in 409.

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
| Manager | Person | - | Back-office user with the MANAGER role | [UC2 - Register User](./register-user.md) |
| User | Person | - | Person who is not authenticated yet | [UC1 - Login](./login.md) |
| Route (Joi) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | [UC1 - Login](./login.md) |
| Route (Joi & RBAC) | Component | Express router and middleware | Authenticates the request (`verifyToken`), authorizes by role (`requireRole`), validates ids, query and payload with Joi and delegates to the controller | [UC2 - Register User](./register-user.md) |
| AuthController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC1 - Login](./login.md) |
| UsersController | Component | Express controller | Translates the HTTP request into a service call and the result into an HTTP response | [UC2 - Register User](./register-user.md) |
| AuthService | Component | Node.js module | Orchestrates the use case: loads data through repositories, applies domain rules, maps entities to DTOs and translates domain and persistence errors into `AppError` | All diagrams |
| UsersDomain | Component | Node.js module | Validation and normalization rules of the domain | [UC2 - Register User](./register-user.md) |
| UsersRepository | Component | MongoDB (production) or Dummy (tests) | Persistence access behind a repository interface | All diagrams |

## Conversion notes

- "Login" keeps the participant name "Route (Joi)" because that route applies no authentication or role check.
- "Register User" is filed here because it is handled by `AuthService`, although it uses `UsersController`, `UsersDomain` and `UsersRepository`, as in the original.
- In "Register User" the repository activation is closed only in the success branch. The original closed it in both branches, which Mermaid does not accept.
