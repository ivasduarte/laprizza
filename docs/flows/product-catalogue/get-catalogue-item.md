# UC2: Get Catalogue Item by ID

## Use Case View

**Primary Actor:** Customer / Manager / Employee <br>
**Description:** Allows an authenticated user to consult the details of a product offered for sale using its unique ID.

**Preconditions:**

- The user must be authenticated and have the `CUSTOMER`, `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The User provides the ID of the product.
2. The System validates the MongoDB ObjectId format of the ID.
3. The System searches the database for a product matching the ID.
4. The System verifies that the product is active and sellable.
5. The System maps the product to a Catalogue DTO, including category, allergens and available sizes, and returns it with a 200 OK status.

**Alternative Flows:**

- _Invalid ID format:_ The System throws a 400 Bad Request error.
- _Product not found, inactive or not sellable:_ The System throws a 404 Not Found error (the product is considered not found in the catalogue).
- _Request by unauthorized user (No token):_ The System throws a 401 Unauthorized error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

- Catalogue items can be queried individually by their unique product ID.
- **Crucial Rule:** The product must exist, be active (`isActive: true`), and be designated as sellable (`sellable: true`). If any of these conditions fail, the product is considered "not found in the catalogue".
- The ID must conform to the MongoDB ObjectId format.
- Users with `CUSTOMER`, `MANAGER`, and `EMPLOYEE` roles can view catalogue item details.

## 2. Solution Design

![get-catalogue-item](./diagrams/get-catalogue-item.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`product-catalogue.service.test.js`):**
  - `getCatalogueItemById returns the correct Catalogue DTO for a valid, active, and sellable product`
  - `getCatalogueItemById throws 404 AppError if the product does not exist`
  - `getCatalogueItemById throws 404 AppError if the product is inactive`
  - `getCatalogueItemById throws 404 AppError if the product is not sellable`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/catalogue/:id`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with invalid ID format -> `400 Bad Request` (Joi CastError prevention)
  - Request for a non-existent Product ID -> `404 Not Found`
  - Request for an inactive or non-sellable Product ID -> `404 Not Found`
  - Request for a valid, active, sellable Product ID by allowed roles -> `200 OK` (Returns Catalogue DTO)
