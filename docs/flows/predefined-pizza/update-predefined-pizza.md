# UC5: Update Predefined Pizza

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- Only the sizes and the default configuration can be changed; the product that represents the pizza cannot;
- The lists sent replace the stored ones (they are not merged); the list that is not sent keeps its stored value;
- Whenever sizes or components are sent, the configuration is revalidated with the same rules as in UC1;
- At least one of `sizeIds`, `componentIds` or `isActive` must be sent;
- Only users with the `MANAGER` role can update Predefined Pizzas.

## 2. Solution Design

![UC10_5_Update_Predefined_Pizza](diagrams/update-predefined-pizza.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`predefined-pizzas.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Send a new valid list of components. Result: The default configuration is replaced and the sizes are kept.
- **Scenario B:** Send a new valid list of sizes. Result: The sizes are replaced and the default configuration is kept.
- **Scenario C:** Send a list that breaks a rule (e.g. no dough, or an inactive component). Result: Throws `AppError` (400 Bad Request).
- **Scenario D:** Send an empty body. Result: Throws `AppError` (400 Bad Request).
- **Scenario E:** Update a Predefined Pizza that does not exist. Result: Throws `AppError` (404 Not Found).
- **Scenario F:** Request the update with the `EMPLOYEE` role. Result: The request is rejected (403 Forbidden) before reaching the service.

## 4. Postman E2E Tests

- **Base Endpoint:** `PUT /api/v1/predefined-pizzas/{id}`
- **Validated Scenarios:**
  - New valid `componentIds` -> `200 OK` (Returns the updated Predefined Pizza)
  - New valid `sizeIds` -> `200 OK`
  - Invalid configuration (inactive component) -> `400 Bad Request`
  - Empty body -> `400 Bad Request` (Blocked by Joi validation)
