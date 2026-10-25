# UC1: Define Predefined Pizza

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to define a Predefined Pizza by associating a sellable product with the Pizza Sizes in which it is available and with a default configuration of Pizza Components.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.
- The product that represents the pizza, the Pizza Sizes and the Pizza Components to be used must already be registered in the system.

**Main Success Scenario:**

1. The Manager provides the `productId`, the list of `sizeIds` and the list of `componentIds` (default configuration).
2. The System validates that all fields are present, that the ids have a valid format and that both lists are not empty.
3. The System verifies that the product exists, is active, is sellable and is not a Pizza Component.
4. The System verifies that neither list contains repeated ids.
5. The System verifies that every Pizza Size exists and is active.
6. The System verifies that every component exists, is active and is designated as a Pizza Component.
7. The System verifies that the number of components of each Pizza Component Type respects its minimum and maximum, including the types with a minimum greater than zero.
8. The System verifies that every component has a Component Size Configuration for every selected Pizza Size.
9. The System verifies that the product does not already have a Predefined Pizza and saves the new one as active.
10. The System returns the new Predefined Pizza with a 201 Created status.

**Alternative Flows:**

- _Missing fields, invalid ids or empty lists:_ The System throws a 400 Bad Request error.
- _Invalid product, repeated ids, unknown or inactive size/component, component without type, Pizza Component Type limits not respected or missing Component Size Configuration:_ The System throws a 400 Bad Request error and nothing is stored.
- _Request by unauthorized user (No token or Employee):_ The System throws a 401 Unauthorized or 403 Forbidden error.
- _A Predefined Pizza already exists for the product:_ The System throws a 409 Conflict error.

**Postconditions:**

- The new Predefined Pizza is saved in the database as active.
- The Predefined Pizza keeps its product, its available Pizza Sizes and its default configuration.

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- A Predefined Pizza has no name of its own: it is represented by a sellable product, and there is at most one Predefined Pizza per product (unique index on `productId`);
- The product must be active, sellable and must not be a Pizza Component;
- The default configuration is a single list of Pizza Component ids, shared by all the sizes in which the pizza is available; no quantity is stored per component;
- The minimum and maximum of each Pizza Component Type count distinct components, and every type with a minimum greater than zero must be present;
- A size can only be used if it is active and every component of the default configuration has a Component Size Configuration for it;
- Unknown product, size or component ids are reported as invalid pizza data (400 Bad Request), not as 404;
- Only users with the `MANAGER` role can define Predefined Pizzas.

## 2. Solution Design

![UC1_Define_Predefined_Pizza](diagrams/define-predefined-pizza.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`predefined-pizzas.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Provide an active sellable product, active sizes and components that respect every rule (e.g. dough, sauce and cheese for Small and Large). Result: The Predefined Pizza is stored as active and returned with its `productId`, `sizeIds` and default configuration `componentIds`.
- **Scenario B:** Provide a product that does not exist, is inactive, is not sellable or is a Pizza Component. Result: Throws `AppError` (400 Bad Request).
- **Scenario C:** Provide an empty size list or a repeated component. Result: Throws `AppError` (400 Bad Request) and nothing is stored.
- **Scenario D:** Provide a configuration that breaks a rule: unknown, inactive or non-component product, no dough (below `minQuantity`), two doughs or two cheeses (above `maxQuantity`), unknown or inactive size, or a size without a Component Size Configuration for one of the components. Result: Throws `AppError` (400 Bad Request) and nothing is stored.
- **Scenario E:** Provide a minimal configuration (only dough) and several components of a type without maximum (toppings). Result: The Predefined Pizza is stored.
- **Scenario F:** Define a second Predefined Pizza for the same product. Result: Throws `AppError` (409 Conflict).
- **Scenario G:** Request the creation with the `EMPLOYEE` role. Result: The request is rejected (403 Forbidden) before reaching the service.

## 4. Postman E2E Tests

- **Base Endpoint:** `POST /api/v1/predefined-pizzas`
- **Validated Scenarios:**
  - Valid product, sizes and components -> `201 Created` (Returns the Predefined Pizza)
  - Second Predefined Pizza for the same product -> `409 Conflict`
  - Missing `productId`, invalid id or empty size list -> `400 Bad Request` (Blocked by Joi validation)
  - Repeated component -> `400 Bad Request`
  - Inactive component -> `400 Bad Request`
  - No dough (below `minQuantity`) -> `400 Bad Request`
  - Two cheeses (above `maxQuantity`) -> `400 Bad Request`
  - Size without Component Size Configuration -> `400 Bad Request`
  - Product that is a Pizza Component representing the pizza -> `400 Bad Request`
  - Missing token -> `401 Unauthorized`
  - `EMPLOYEE` role -> `403 Forbidden`
