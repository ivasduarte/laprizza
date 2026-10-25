# UC1: List and Search Stock

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows a manager or employee to list the stock of all stock-controlled products, with an optional case-insensitive partial match search on the product's name.

**Preconditions:**

- The user must be authenticated with the `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The user requests the stock list, optionally providing a search term.
2. The System validates the request query.
3. The System retrieves all stock records, applying the search filter if provided.
4. The System filters out any stock records that have an orphaned or null product reference.
5. The System maps the valid entities to DTOs and returns them with a 200 OK status.

**Alternative Flows:**

- _No matching products found:_ The System returns an empty list `[]` with a 200 OK status.
- _Unauthorized user (`CUSTOMER` or no token):_ The System returns a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

- The system allows listing the stock of all stock-controlled products, optionally filtered by a search term.
- The search term performs a case-insensitive partial match on the product's `name`.
- Only products that have a valid reference to a product (`productId` is populated) are returned.
- Users with both `MANAGER` and `EMPLOYEE` roles are authorized to list and search stock.

## 2. Solution Design

![list-search-stock](./diagrams/list-search-stock.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`stock.dummy.repository.js` and `products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`stock.service.test.js`):**
  - `listStock returns all stock records`
  - `listStock filters by product name search query`
  - `listStock filters out stock records with orphaned/null product references`
  - `listStock correctly maps to Stock DTO`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/stock`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `CUSTOMER` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Valid request without search query -> `200 OK` (Returns all stock)
  - Valid request with matching product name search query -> `200 OK`
  - Valid request with non-matching search query -> `200 OK` (Returns `[]`)
