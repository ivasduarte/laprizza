# UC1: List and Search Catalogue

## 1. Domain Assumptions

- The product catalogue exposes products to be viewed by customers and staff.
- **Crucial Rule:** Only products that are both active (`isActive: true`) and designated as sellable (`sellable: true`) are returned by the catalogue.
- The system allows listing the catalogue items or filtering them based on a search term and/or category ID.
- The search term performs a case-insensitive partial match across the product's `name` and `description`.
- Users with `CUSTOMER`, `MANAGER`, and `EMPLOYEE` roles are authorized to list and search the catalogue.

## 2. Solution Design

![list-search-catalogue](./diagrams/list-search-catalogue.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`product-catalogue.service.test.js`):**
  - `listCatalogue forces isActive and sellable filters on the repository query`
  - `listCatalogue returns all valid catalogue items when no query is provided`
  - `listCatalogue filters products by search term (name/description) and categoryId`
  - `listCatalogue correctly maps product entities to Catalogue DTOs, including nested categories, allergens, and available sizes`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/catalogue`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Valid request without filters by `CUSTOMER`, `MANAGER`, or `EMPLOYEE` -> `200 OK` (Returns all sellable active products)
  - Valid request with matching `search` or `categoryId` filters -> `200 OK`
  - Valid request with non-matching filters -> `200 OK` (Returns `[]`)
