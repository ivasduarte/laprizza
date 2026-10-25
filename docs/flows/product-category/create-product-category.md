# UC1 - Create Product Category

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to create a new product category in the system.

**Preconditions:**

- The user must be authenticated and have the `Manager` role.

**Main Success Scenario:**

1. The Manager provides a valid payload containing the new category name.
2. The System normalizes the name (removing leading, trailing, and repeated spaces) and validates it.
3. The System verifies that the name is unique (or reuses the name of a previously removed category).
4. The System saves the category and returns the corresponding DTO with a 201 Created status.

**Alternative Flows:**

- _Missing, blank or invalid name provided:_ The System throws a 400 Bad Request error.
- _Duplicate active category name:_ The System throws a 409 Conflict error.

**Postconditions:**

- The new product category is saved in the database.

## 1. Domain Assumptions

- Product Categories must have a unique name and identifier;
- The name is mandatory and cannot be empty;
- The name of a removed category can be reused by a new one;
- Only users with the `Manager` role are authorized to create a new product category.

## 2. Solution Design

![Create Product Category Design](./diagrams/create-product-category-design.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All aplication tests use dependency injection via isolated in-memory dummies (`product-categories.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Domain Tests (`product-categories.domain.test.js`):**
  - `normalizeName removes leading, trailing and repeated spaces`
  - `validateName rejects missing, blank and non-text names`
  - `validateName accepts valid names`
- **Application Tests (`product-categories.service.test.js`):**
  - `createProductCategory saves a normalized name and returns a DTO`
  - `createProductCategory rejects blank or missing names without saving`
  - `createProductCategory returns 409 Conflict on duplicate name`
  - `createProductCategory can reuse the name of an inactive category`

## 4. E2E Tests

- **Base Endpoint:** `POST /api/v1/product-categories`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC Enforcement)
  - Valid payload by `MANAGER` -> `201 Created`
  - Missing, blank or invalid name -> `400 Bad Request` (Joi validation)
  - Duplicate category name -> `409 Conflict`
