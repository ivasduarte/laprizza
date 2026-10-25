# UC3 - Update Component Size Configuration

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to update the price and the number of stock units consumed for an existing Component Size Configuration.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The product must be an active Pizza Component.
- The configuration for the specific pizza size must already exist.

**Main Success Scenario:**

1. The Manager provides the product ID, pizza size ID, and a payload with the new price and stock units consumed.
2. The System validates the input data and ID formats.
3. The System verifies the product exists, is active, and is a valid pizza component.
4. The System verifies that the specified pizza size is currently configured.
5. The System applies the updates to the configuration.
6. The System returns the updated Component Size Configuration DTO with a 200 OK status.

**Alternative Flows:**

- _Invalid IDs, missing/invalid price or stock units:_ The System returns a 400 Bad Request error.
- _Unauthorized user:_ The System returns a 401 Unauthorized or 403 Forbidden error.
- _Product not found, inactive, or not a component:_ The System returns a 404 Not Found error.
- _Pizza size not configured:_ The System returns a 404 Not Found error.

**Postconditions:**

- The configuration's price and stock units are updated in the database.

## 1. Domain Assumptions

- The update replaces the price and the number of stock units consumed of an existing configuration;
- The pizza size cannot be changed;
- The new values follow the same rules as in the creation;
- The product must be a Pizza Component;
- Only users with the `Manager` role are authorized to update a Component Size Configuration.

## 2. Solution Design

![Update Component Size Configuration Design](./diagrams/update-component-size-configuration-design.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory dummies (`products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`component-size-configuration.service.tests.js`):**
  - `updateComponentSizeConfiguration changes the price and the stock units`
  - `updateComponentSizeConfiguration accepts a price of zero and works without stock control`
  - `updateComponentSizeConfiguration rejects invalid data without changing the configuration`
  - `updateComponentSizeConfiguration does not accept stock units for components without stock control`
  - `updateComponentSizeConfiguration rejects a product that stopped being a pizza component`
  - `updateComponentSizeConfiguration throws 404 if the product does not exist or is inactive`
  - `updateComponentSizeConfiguration throws 404 if the size is not configured`
  - `updateComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime`
  - `updateComponentSizeConfiguration validates the data before looking for the product`

## 4.E2E Tests

- **Base Endpoint:** `PUT /api/v1/products/{productId}/size-configurations{sizeId}`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC Enforcement)
  - Valid payload by `MANAGER` -> `200 OK`
  - Invalid ids, missing or invalid price or stock units -> `400 Bad Request`
  - Unknown product, or unconfigured pizza size -> `404 Not Found`
