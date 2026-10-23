# UC3: Get Customer by ID

## 1. Domain Assumptions
* Due to a lack of client clarification, the following domain restrictions were inquired in the code:
    * Customers can be queried individually by their ID;
    * The ID must conform to the MongoDB ObjectId format;
    * Only users with the `MANAGER` role can view customer details.

## 2. Solution Design
![UC3_Get_Customer_Design](./UC3_Get_Customer_Design.svg)

## 3. Business Test Planning
* **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`customers.dummy.repository.js`), avoiding Mocking libraries entirely.
* **Application Tests (`customers.service.test.js`):**
    * `getCustomerById and listCustomers fetch and map correctly`

## 4. Postman E2E Tests
* **Base Endpoint:** `GET /api/v1/customers/:id`
* **Validated Scenarios:**
    * Request without Bearer Token -> `401 Unauthorized`
    * Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
    * Request with invalid ID format -> `400 Bad Request` (Joi CastError prevention)
    * Request with non-existent ID -> `404 Not Found`
    * Request with valid ID -> `200 OK` (Returns customer DTO)