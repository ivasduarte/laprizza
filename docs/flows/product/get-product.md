# UC3: Get Product by ID

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows an authenticated user to retrieve the details of a specific product by its unique ID.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The User provides the ID of the target product.
2. The System validates the MongoDB ObjectId format of the ID.
3. The System searches the database for a product matching the ID.
4. The System maps the entity to a DTO and returns it with a 200 OK status.

**Alternative Flows:**

- _Invalid ID format:_ The System throws a 400 Bad Request error.
- _Product not found:_ The System throws a 404 Not Found error.
- _Request by unauthorized user:_ The System throws a 401 Unauthorized error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

- Products can be queried individually by their unique ID.
- The ID must conform to the MongoDB ObjectId format.
- Users with both `MANAGER` and `EMPLOYEE` roles can view product details.

## 2. Solution Design

![get-product](./diagrams/get-product.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`products.service.test.js`):**
  - `getProductById returns correct product DTO`
  - `getProductById throws 404 AppError if product does not exist`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/products/:id`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with invalid ID format -> `400 Bad Request` (Joi CastError prevention)
  - Request with non-existent ID -> `404 Not Found`
  - Request with valid ID by `MANAGER` or `EMPLOYEE` -> `200 OK` (Returns product DTO)
