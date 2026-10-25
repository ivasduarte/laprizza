# UC1: Register Customer

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to register a new customer in the system, capturing personal details, contact info, and dietary restrictions.

**Preconditions:**

- The Manager must be authenticated and authorized.

**Main Success Scenario:**

1. The Manager provides the new customer's details (name, email, phone, address, dietary restrictions).
2. The System validates the provided data (e.g., postal code matches city, Portuguese phone format).
3. The System normalizes the phone number.
4. The System verifies that the email and phone number are not already in use.
5. The System creates and persists the new customer record.
6. The System returns the newly created customer details.

**Alternative Flows:**

- _Invalid data provided:_ The System throws a 400 Bad Request error (e.g., invalid phone format, postal code mismatch).
- _Duplicate email or phone:_ The System throws a 409 Conflict error.

**Postconditions:**

- The new customer is saved in the database.

## 1. Domain Assumptions

- The NIF (Tax Identification Number) is an optional piece of information, primarily collected for future invoicing purposes.

**_Sprint 1 Constraint (Late Client Feedback):_**

The business rule stipulating autonomous customer registration through a separate public endpoint was only confirmed by the client close to the Sprint 1 delivery date. For risk management reasons, the implementation of this specific flow (Customer Self-Registration) is being moved to Sprint 2. In the current version, user registration with the `CUSTOMER` role is performed via Manager.

## 2. Solution Design

![register-customer](./diagrams/register-customer.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`customers.dummy.repository.js`) and a Dummy Postal Code Validator, avoiding Mocking libraries entirely.
- **Domain Tests (`customers.domain.test.js`):**
  - `validatePhoneNumber validates strictly Portuguese formats`
  - `normalizePhoneNumber returns the 9 national digits or null`
  - `validateAddress relies securely on the injected validator`
- **Application Tests (`customers.service.test.js`):**
  - `createCustomer enforces domain validations before saving`
  - `createCustomer stores the phone normalized and rejects duplicates in any format`
  - `createCustomer and updateCustomer turn an address mismatch into a 400 AppError`

## 4. Postman E2E Tests

- **Base Endpoint:** `POST /api/v1/customers`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Valid payload by `MANAGER` -> `201 Created`
  - Missing mandatory fields or duplicate allergens in array -> `400 Bad Request` (Joi validation)
  - Postal code and city mismatch -> `400 Bad Request`
  - Duplicate email or phone number -> `409 Conflict`
