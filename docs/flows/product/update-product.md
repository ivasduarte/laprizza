# UC4: Update Product

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to partially update a product's details or logically deactivate it.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The product must exist.

**Main Success Scenario:**

1. The Manager provides the ID of the product and a payload containing the fields to update.
2. The System validates the ID format and ensures the payload contains at least one field.
3. The System finds the targeted product in the database.
4. If name or description are updated, the System enforces domain validation.
5. If references (categories, allergens, types) are updated, the System verifies they exist and are active.
6. The System verifies that if the product is set to sellable, a valid price is defined.
7. The System successfully applies partial changes (or deactivation) to the product.
8. The System returns the updated product DTO with a 200 OK status.

**Alternative Flows:**

- _Invalid ID or empty payload:_ The System throws a 400 Bad Request error.
- _Sellable rule violation (sellable updated to true but price is invalid):_ The System throws a 400 Bad Request error.
- _Product or referenced entity not found / inactive:_ The System throws a 404 Not Found error.
- _Deactivation rule violation (attempting to set `isActive: false` with active size configurations):_ The System throws a 409 Conflict error.
- _Duplicate product name:_ The System throws a 409 Conflict error.
- _Request by Employee or missing token:_ The System throws a 403 Forbidden or 401 Unauthorized error.

**Postconditions:**

- The product details are updated or the product is deactivated in the database.

## 1. Domain Assumptions

- Products can have their details partially updated (name, description, price, sellable, stockControlled, references, etc.).
- Products can be logically deleted (deactivated) by setting `isActive: false`.
- **Crucial Rule:** A product cannot be deactivated (`isActive: false`) if it currently has active size configurations (`sizeConfigurations.length > 0`). These must be removed first.
- If a product is updated to `sellable: true`, it must have a valid `price` defined (>= 0).
- Updating the name requires the new name to be unique and domain-validated.
- Only users with the `MANAGER` role can update product details.

## 2. Solution Design

![update-product](./diagrams/update-product.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies, avoiding Mocking libraries entirely.
- **Application Tests (`products.service.test.js`):**
  - `updateProduct applies partial changes and preserves existing data`
  - `updateProduct enforces domain validation on updated name and description`
  - `updateProduct refuses to set isActive to false if product has sizeConfigurations`
  - `updateProduct throws 400 if product is updated to sellable without a valid price`
  - `updateProduct verifies referenced entities (category, allergens, component type) exist and are active`
  - `updateProduct rejects a name used by another product (409 Conflict)`

## 4. Postman E2E Tests

- **Base Endpoint:** `PATCH /api/v1/products/:id`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Empty JSON payload -> `400 Bad Request` (Requires at least one field to update)
  - Invalid ID format -> `400 Bad Request`
  - Non-existent ID -> `404 Not Found`
  - Invalid referenced entity (category/allergen) -> `404 Not Found`
  - Deactivation (`isActive: false`) when having size configurations -> `409 Conflict`
  - Duplicate product name -> `409 Conflict`
  - Valid partial update or deactivation -> `200 OK`
