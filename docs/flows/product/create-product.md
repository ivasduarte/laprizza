# UC1: Create Product

## 1. Domain Assumptions

- Products must have a unique name.
- The name and description are mandatory and cannot be empty (enforced by domain validation).
- If a product is marked as `sellable: true`, it must have a valid `price` defined (greater than or equal to 0).
- A product can be linked to a Product Category, a Pizza Component Type, and multiple Allergens. All referenced entities must exist and be active.
- If a product is created with `stockControlled: true`, the system automatically initializes a Stock entry with `quantity: 0` for this product.
- Only users with the `MANAGER` role are authorized to create a new product.

## 2. Solution Design

![create-product](./diagrams/create-product.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`products.dummy.repository.js`, `product-categories.dummy.repository.js`, `allergen.dummy.repository.js`, `pizza-component-type.dummy.repository.js`, and `stock.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Domain Tests (`products.domain.test.js`):**
  - `validateProductName rejects non-string or empty values`
  - `validateProductDescription rejects non-string or empty values`
- **Application Tests (`products.service.test.js`):**
  - `createProduct enforces domain validations before saving`
  - `createProduct verifies if referenced category, component type, and allergens exist and are active`
  - `createProduct enforces price >= 0 if the product is sellable`
  - `createProduct automatically creates a stock entry if stockControlled is true`
  - `createProduct returns 409 Conflict on duplicate product name`

## 4. Postman E2E Tests

- **Base Endpoint:** `POST /api/v1/products`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Valid payload by `MANAGER` -> `201 Created`
  - Missing mandatory fields or negative price -> `400 Bad Request` (Joi validation)
  - Sellable product without price -> `400 Bad Request` (Business rule)
  - Referenced category/allergen/component type not found or inactive -> `404 Not Found`
  - Duplicate product name -> `409 Conflict`
