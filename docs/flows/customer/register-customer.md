# UC1: Register Customer

## 1. Domain Assumptions
* Due to a lack of client clarification, the following domain restrictions were inquired in the code:
    * Customers must have a unique email address and a unique phone number;
    * Phone numbers must be valid Portuguese phone numbers (9 digits starting with 9, 2, or +351/00351 prefixes) and are normalized before persistence;
    * Dietary restrictions can be associated with a customer by referencing existing Allergen IDs. Duplicate restrictions are blocked;
    * Only users with the `MANAGER` role are authorized to register a new customer.

## 2. Solution Design
![register-customer](./diagrams/register-customer.svg)

## 3. Business Test Planning
* **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`customers.dummy.repository.js`) and a Dummy Postal Code Validator, avoiding Mocking libraries entirely.
* **Domain Tests (`customers.domain.test.js`):**
    * `validatePhoneNumber validates strictly Portuguese formats`
    * `normalizePhoneNumber returns the 9 national digits or null`
    * `validateAddress relies securely on the injected validator`
* **Application Tests (`customers.service.test.js`):**
    * `createCustomer enforces domain validations before saving`
    * `createCustomer stores the phone normalized and rejects duplicates in any format`
    * `createCustomer and updateCustomer turn an address mismatch into a 400 AppError`

## 4. Postman E2E Tests
* **Base Endpoint:** `POST /api/v1/customers`
* **Validated Scenarios:**
    * Request without Bearer Token -> `401 Unauthorized`
    * Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
    * Valid payload by `MANAGER` -> `201 Created`
    * Missing mandatory fields or duplicate allergens in array -> `400 Bad Request` (Joi validation)
    * Postal code and city mismatch -> `400 Bad Request`
    * Duplicate email or phone number -> `409 Conflict`