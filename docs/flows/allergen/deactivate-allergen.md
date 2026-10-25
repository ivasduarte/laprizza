# UC5: Deactivate Allergen

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to logically deactivate an existing allergen, provided it is not referenced by any products or customers.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The targeted allergen must exist, be active, and not be referenced by products or customer dietary restrictions.

**Main Success Scenario:**

1. The Manager provides the ID of the allergen and a payload specifying `{ "isActive": false }`.
2. The System validates the ID format and ensures the payload strictly matches the deactivation command.
3. The System verifies the allergen exists and is currently active.
4. The System checks if the allergen is referenced by any product or customer.
5. The System updates the allergen's status to inactive.
6. The System returns the updated allergen details with a 200 OK status.

**Alternative Flows:**

- _Invalid ID, invalid payload, or attempting renaming/reactivation:_ The System throws a 400 Bad Request error.
- _Allergen not found or already inactive:_ The System throws a 404 Not Found error.
- _Allergen is referenced by products or customers:_ The System throws a 409 Conflict error.

**Postconditions:**

- The targeted allergen is logically deactivated in the database.

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- Allergens are never deleted, only deactivated, so existing business information remains consistent;
- Only `{ "isActive": false }` is accepted: an allergen cannot be renamed or reactivated;
- An allergen referenced by a product (`allergenIds`) or by a customer's dietary restrictions (`dietaryRestrictions.allergenIds`) cannot be deactivated;
- The name of a deactivated allergen stays reserved, so it cannot be used by a new allergen.

## 2. Solution Design

![UC5_Deactivate_Allergen](diagrams/deactivate-allergen.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`allergens.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Deactivate an allergen that is not referenced. Result: The allergen is returned with `isActive: false` and is no longer returned by the queries.
- **Scenario B:** Deactivate an allergen referenced by a product or by a customer. Result: Throws `AppError` (409 Conflict).
- **Scenario C:** Send a body other than `{ "isActive": false }` (e.g. a new name). Result: Throws `AppError` (400 Bad Request, only deactivation is supported).
- **Scenario D:** Deactivate an allergen that does not exist or is already inactive. Result: Throws `AppError` (404 Not Found).

## 4. Postman E2E Tests

- **Base Endpoint:** `PUT /api/v1/allergens/{id}`
- **Validated Scenarios:**
  - `{ "isActive": false }` for an allergen without references -> `200 OK` (Returns the allergen with `isActive: false`; a `name` sent in the body is ignored)
  - Empty body, only `name`, `isActive: true` or invalid `isActive` -> `400 Bad Request` (Blocked by Joi validation)
  - Id with an invalid format -> `400 Bad Request`
  - Unknown id -> `404 Not Found`
  - Deactivating the same allergen again -> `404 Not Found`
  - Get by id, get by name and list after deactivation -> `404 Not Found` (list: `200 OK` without the allergen)
  - Create an allergen with the name of a deactivated one -> `409 Conflict`
  - Missing token -> `401 Unauthorized`
