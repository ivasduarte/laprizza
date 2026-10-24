# UC3: Consult Predefined Pizza by ID

## 1. Domain Assumptions
Due to a lack of client clarification, the following domain restrictions were assumed in the code:
* The identifier is a 24-character hexadecimal string (MongoDB ObjectId);
* A deactivated Predefined Pizza is treated as if it did not exist (404 Not Found);
* The details contain the product (`id`, `name`), the sizes (`id`, `name`, `isActive`) and the components of the default configuration, each with its Pizza Component Type, ordered by assembly order;
* Both the `MANAGER` and `EMPLOYEE` roles can consult a Predefined Pizza.

## 2. Solution Design
![UC3_Consult_Predefined_Pizza_by_ID](diagrams/consult-predefined-pizza-by-id.svg)

## 3. Business Test Planning
* All unit tests use isolated in-memory Dummy Repositories (`predefined-pizzas.dummy.repository.js`). The Mockito library isn't used in this project.
* **Scenario A:** Provide the id of an active Predefined Pizza. Result: The details are returned, with the product name, the sizes and the components ordered by assembly order (e.g. Base Dough, Base Sauce, Cheese, Topping), each with its Pizza Component Type and limits.
* **Scenario B:** Provide the id of a Predefined Pizza that was deactivated. Result: Throws `AppError` (404 Not Found).
* **Scenario C:** Provide an id that does not exist. Result: Throws `AppError` (404 Not Found).

## 4. Postman E2E Tests

* **Base Endpoint:** `GET /api/v1/predefined-pizzas/{id}`
* **Validated Scenarios:**
    * Existing id, as Employee -> `200 OK` (Returns the details)
    * Id with an invalid format -> `400 Bad Request` (Blocked by id validation)
    * Valid but unknown id -> `404 Not Found`
    * Id of a deactivated Predefined Pizza -> `404 Not Found`
