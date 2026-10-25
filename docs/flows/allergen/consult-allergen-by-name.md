# UC4: Consult Allergen by Name

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows an authenticated user to retrieve an active allergen using its exact name.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The User provides the exact name of the target allergen.
2. The System validates the request payload.
3. The System searches the database for an active allergen with that exact name (case-insensitive).
4. The System returns the allergen details with a 200 OK status.

**Alternative Flows:**

- _Invalid or missing name parameter:_ The System throws a 400 Bad Request error.
- _Partial name provided / Allergen not found or deactivated:_ The System throws a 404 Not Found error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- The lookup by name is exact: a partial name does not match;
- Special characters in the name are treated as plain text;
- A deactivated allergen is treated as if it did not exist (404 Not Found).

## 2. Solution Design

![UC4_Consult_Allergen_by_Name](diagrams/consult-allergen-by-name.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`allergens.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Provide the exact name of an existing active allergen. Result: The allergen is returned as `{ id, name, isActive }`.
- **Scenario B:** Provide only part of an allergen name. Result: Throws `AppError` (404 Not Found).
- **Scenario C:** Provide the name of an allergen that was deactivated or does not exist. Result: Throws `AppError` (404 Not Found).

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/allergens/name/{name}`
- **Validated Scenarios:**
  - Exact name -> `200 OK` (Returns the allergen)
  - Unknown name -> `404 Not Found`
  - Partial name -> `404 Not Found`
  - Name of a deactivated allergen -> `404 Not Found`
