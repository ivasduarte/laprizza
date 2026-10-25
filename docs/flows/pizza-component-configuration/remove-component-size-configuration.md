# UC4 - Remove Component Size Configuration

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to remove a Component Size Configuration, freeing the pizza size to be configured again for the product.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The product and the configuration must exist.

**Main Success Scenario:**

1. The Manager provides the product ID and pizza size ID to be removed.
2. The System validates the ID formats.
3. The System finds the product and retrieves the specific size configuration (works even if the product is inactive).
4. The System removes the size configuration from the product.
5. The System returns the removed configuration details with a 200 OK status.

**Alternative Flows:**

- _Invalid IDs:_ The System returns a 400 Bad Request error.
- _Unauthorized user:_ The System returns a 401 Unauthorized or 403 Forbidden error.
- _Product or configuration not found (or disappeared):_ The System returns a 404 Not Found error.

**Postconditions:**

- The configuration is removed from the database, and the pizza size can be used again for a new configuration on this product.

## 1. Domain Assumptions

- After the removal, the pizza size is free to be configured again for the product;
- A product that has Component Size Configurations cannot be deactivated, and neither can a pizza size that is used in the configurations of any product;
- Only users with the `MANAGER` role are authorized to remove a Component Size Configuration.

## 2. Solution Design

![Remove Component Size Configuration Design](./diagrams/remove-component-size-configuration-design.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory dummies (`products.dummy.repository.js` and `pizza-size.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`component-size-configuration.service.tests.js`):**
  - `removeComponentSizeConfiguration removes the configuration and returns it`
  - `removeComponentSizeConfiguration also works for an inactive product`
  - `removeComponentSizeConfiguration throws 404 if the product or the configuration does not exist`
  - `removeComponentSizeConfiguration throws 404 if the configuration was already removed`
  - `removeComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime`
  - `removing a configuration frees the pizza size to be configured again`

## 4.E2E Tests

- **Base Endpoint:** `DELETE /api/v1/products/{productId}/size-configurations/{sizeId}`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC Enforcement)
  - Valid payload by `MANAGER` -> `200 OK`
  - Invalid ids -> `400 Bad Request`
  - Unknown product or unconfigured pizza size -> `404 Not Found`
