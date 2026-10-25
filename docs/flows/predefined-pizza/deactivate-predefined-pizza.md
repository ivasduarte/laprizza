# UC6: Deactivate Predefined Pizza

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to logically deactivate an active Predefined Pizza.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The Predefined Pizza must exist and be active.

**Main Success Scenario:**

1. The Manager provides the ID of the Predefined Pizza and a payload `{ "isActive": false }`.
2. The System validates the ID format and that the payload only accepts `isActive` as `false`.
3. The System finds the Predefined Pizza and verifies that it is active.
4. The System sets the Predefined Pizza as inactive, without changing the product or the components.
5. The System returns the Predefined Pizza with `isActive: false` and a 200 OK status.

**Alternative Flows:**

- _Invalid ID, `isActive: true` or any other value:_ The System throws a 400 Bad Request error.
- _Predefined Pizza not found or already deactivated:_ The System throws a 404 Not Found error.
- _Request by unauthorized user (No token or Employee):_ The System throws a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- The Predefined Pizza is logically deactivated in the database and can no longer be listed or consulted.

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- Predefined Pizzas are never deleted, only deactivated; a deactivated one cannot be reactivated;
- Only `{ "isActive": false }` is accepted as a deactivation; any other value of `isActive` is rejected;
- Deactivating does not change the product or the components, and the deactivation is not blocked by any reference check;
- Only users with the `MANAGER` role can deactivate Predefined Pizzas.

## 2. Solution Design

![UC6_Deactivate_Predefined_Pizza](diagrams/deactivate-predefined-pizza.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`predefined-pizzas.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Deactivate an active Predefined Pizza. Result: The Predefined Pizza is returned with `isActive: false` and is no longer returned by the list or by the consultations.
- **Scenario B:** Send `isActive: true`. Result: Throws `AppError` (400 Bad Request, only deactivation is supported).
- **Scenario C:** Deactivate a Predefined Pizza that does not exist. Result: Throws `AppError` (404 Not Found).
- **Scenario D:** Request the deactivation with the `EMPLOYEE` role. Result: The request is rejected (403 Forbidden) before reaching the service.

## 4. Postman E2E Tests

- **Base Endpoint:** `PUT /api/v1/predefined-pizzas/{id}`
- **Validated Scenarios:**
  - `{ "isActive": false }` -> `200 OK` (Returns the Predefined Pizza with `isActive: false`)
  - `{ "isActive": true }` -> `400 Bad Request` (Blocked by Joi validation)
  - Get by id and get by name after the deactivation -> `404 Not Found`
  - `EMPLOYEE` role -> `403 Forbidden`
