# UC3: Consult Allergen by ID

## 1. Domain Assumptions
Due to a lack of client clarification, the following domain restrictions were assumed in the code:
* The allergen identifier is a 24-character hexadecimal string (MongoDB ObjectId);
* A deactivated allergen is treated as if it did not exist (404 Not Found).

## 2. Solution Design
![UC3_Consult_Allergen_by_ID](diagrams/consult-allergen-by-id.svg)

## 3. Business Test Planning
* All unit tests use isolated in-memory Dummy Repositories (`allergens.dummy.repository.js`). The Mockito library isn't used in this project.
* **Scenario A:** Provide the id of an existing active allergen. Result: The allergen is returned as `{ id, name, isActive }`.
* **Scenario B:** Provide the id of an allergen that was deactivated. Result: Throws `AppError` (404 Not Found).
* **Scenario C:** Provide an id that does not exist. Result: Throws `AppError` (404 Not Found).

## 4. Postman E2E Tests

* **Base Endpoint:** `GET /api/v1/allergens/{id}`
* **Validated Scenarios:**
    * Existing id -> `200 OK` (Returns the allergen)
    * Id with an invalid format -> `400 Bad Request` (Blocked by id validation)
    * Unknown id -> `404 Not Found`
    * Id of a deactivated allergen -> `404 Not Found`
