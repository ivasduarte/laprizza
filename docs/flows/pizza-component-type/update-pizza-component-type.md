# UC3 - Update Pizza Component Type

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to update the details of an existing pizza component type, replacing its name, assembly order, and quantity limits.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The pizza component type must exist and be active.

**Main Success Scenario:**

1. The Manager provides the ID of the component type and a payload with the new values.
2. The System validates the ID format and ensures the payload complies with domain rules (valid name format, valid integers, max >= min).
3. The System verifies that the component type exists.
4. The System verifies that the updated name and assembly order do not conflict with other active types.
5. The System applies the changes to the database.
6. The System returns the updated component type DTO with a 200 OK status.

**Alternative Flows:**

- _Invalid payload or ID format:_ The System throws a 400 Bad Request error.
- _Pizza component type not found or already removed:_ The System throws a 404 Not Found error (leaves it unchanged).
- _Duplicate name or assembly order:_ The System throws a 409 Conflict error.
- _Request by unauthorized user:_ The System throws a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- The pizza component type details are updated in the database.

## 1. Domain Assumptions

- The update may replace the name, the assembly order and the quantity limits;
- The new values follow the sames rules as in the creation;
- Only users with the `MANAGER` role are authorized to update a pizza component type.

## 2. Solution Design

![Update Pizza Component Type Design](./diagrams/update-pizza-component-type-design.svg)

## 3. Business Test Planning

- **Issolation Strategy:** All application tests use dependency injection via isolated in-memory dummies (`pizza-component-type.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`pizza-component-type.service.test.js`):**
  - `updatePizzaComponentType changes all the properties`
  - `updatePizzaComponentType keeps its own assembly order and allows changing only the case of its name`
  - `updatePizzaComponentType rejects invalid data without changing the type`
  - `updatePizzaComponentType returns 409 Conflict on duplicate name`
  - `updatePizzaComponentType returns 409 Conflict on duplicate assembly order`
  - `updatePizzaComponentType throws 404 if the type does not exist`
  - `updatePizzaComponentType validates the data before looking for the type`
  - `updatePizzaComponentType throws 404 for a removed type and leaves it unchanged`

## 4. E2E Tests

- **Base Endpoint:** `PUT /api/v1/pizza-component-type/{id}`
- **Validated Scenarios:**
  - Request with Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC Enforcement)
  - Valid payload by `MANAGER` -> `200 OK`
  - Invalid id, empty body or maximum lower than minimum -> `400 Bad Request`
  - Unknown type -> `404 Not Found`
  - Name or assembly order of another type -> `409 Conflict`
