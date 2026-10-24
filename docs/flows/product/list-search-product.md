# UC2: List and Search Products

## 1. Domain Assumptions

- The system allows listing all products or filtering them based on multiple criteria: a search term, `categoryId`, `isActive`, and `sellable` status.
- The search term performs a case-insensitive partial match across the product's `name` and `description`.
- Users with both `MANAGER` and `EMPLOYEE` roles can view and search the product list.

## 2. Solution Design

![list-search-product](./diagrams/list-search-product.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`products.service.test.js`):**
  - `listProducts returns all products when no query is provided`
  - `listProducts filters products by search term (name/description), categoryId, sellable, and isActive`
  - `listProducts maps data to safe DTOs`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/products`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Valid request without filters by `MANAGER` or `EMPLOYEE` -> `200 OK` (Returns all products)
  - Valid request with matching `search` or `categoryId` filters -> `200 OK` (Returns matched products)
  - Valid request with non-matching filters -> `200 OK` (Returns `[]`)
