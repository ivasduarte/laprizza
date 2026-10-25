# UC2: List and Search Pizza Sizes

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows an authenticated manager to list all pizza sizes or filter them based on a search term.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.

**Main Success Scenario:**

1. The Manager requests the list of pizza sizes, optionally providing a search query.
2. The System validates the query parameters.
3. The System queries the database, applying a case-insensitive partial match on the pizza size name if a search term is provided.
4. The System maps the found entities to DTOs.
5. The System returns the list of pizza sizes with a 200 OK status.

**Alternative Flows:**

- _No matching sizes found:_ The System returns an empty list `[]` with a 200 OK status.
- _Request by unauthorized user:_ The System throws a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

- The system allows listing all pizza sizes or filtering them based on a search term;
- The search term performs a case-insensitive partial match on the pizza size name;
- Only users with the `MANAGER` role can view the pizza sizes list via this specific endpoint in this sprint.

## 2. Solution Design

![list and search pizza size](./diagrams/list-search-pizza-size.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`pizza-size.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`pizza-size.service.test.js`):**
  - `listSizes returns all sizes or filters by search query`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/pizza-size`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Valid request without search query -> `200 OK` (Returns matched pizza sizes)
  - Valid request with non-matching search query -> `200 OK` (Returns `[]`)
