# UC2: List and Search Customers

## 1. Domain Assumptions
* Due to a lack of client clarification, the following domain restrictions were inquired in the code:
    * The system allows listing all customers or filtering them based on a search term;
    * The search term performs a case-insensitive partial match across the customer's name, email, and phone number;
    * Only users with the `MANAGER` role can view the customer list.

## 2. Solution Design
![list-search-customer](./diagrams/list-search-customer.svg)

## 3. Business Test Planning
* **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`customers.dummy.repository.js`), avoiding Mocking libraries entirely.
* **Application Tests (`customers.service.test.js`):**
    * `getCustomerById and listCustomers fetch and map correctly`
    * `listCustomers filters by name, email and phone number`

## 4. Postman E2E Tests
* **Base Endpoint:** `GET /api/v1/customers`
* **Validated Scenarios:**
    * Request without Bearer Token -> `401 Unauthorized`
    * Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
    * Valid request without search query -> `200 OK` (Returns all customers)
    * Valid request with matching search query -> `200 OK` (Returns matched customers)
    * Valid request with non-matching search query -> `200 OK` (Returns `[]`)