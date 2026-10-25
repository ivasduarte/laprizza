# UC2: List and Search Predefined Pizzas

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows an authenticated user to list the active Predefined Pizzas or search them by the name of the product that represents them.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The User requests the list of Predefined Pizzas, optionally providing a `name` filter.
2. The System validates the query parameters.
3. If a `name` is provided, the System searches the products whose name contains the text (ignoring letter case) and retrieves their Predefined Pizzas; otherwise, it retrieves all Predefined Pizzas.
4. The System keeps only the active Predefined Pizzas and maps them to DTOs.
5. The System returns the list with a 200 OK status.

**Alternative Flows:**

- _No matching Predefined Pizzas found:_ The System returns an empty list `[]` with a 200 OK status.
- _Empty `name` filter:_ The System throws a 400 Bad Request error.
- _Request by unauthorized user (No token or role not allowed):_ The System throws a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- A Predefined Pizza has no name of its own, so the search by `name` matches the name of the product that represents it (partial, ignoring letter case);
- Only active Predefined Pizzas are listed; they follow the creation order and are not paginated;
- The list returns only the basic data (`id`, `productId`, `sizeIds`, default configuration `componentIds`, `isActive`); the full details are consulted in UC3 and UC4;
- Both the `MANAGER` and `EMPLOYEE` roles can list and search Predefined Pizzas.

## 2. Solution Design

![UC2_List_and_Search_Predefined_Pizzas](diagrams/list-search-predefined-pizzas.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`predefined-pizzas.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Request the list when active and deactivated Predefined Pizzas exist. Result: Only the active ones are returned.
- **Scenario B:** Request the list with a `name` filter (e.g. `MARGH`). Result: Only the active Predefined Pizzas whose product name contains the text (ignoring letter case) are returned.
- **Scenario C:** Request the list with a `name` that matches no product. Result: An empty list is returned (200 OK).
- **Scenario D:** Request the list with the `EMPLOYEE` role. Result: The list is returned (200 OK).

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/predefined-pizzas[?name=]`
- **Validated Scenarios:**
  - List without filter, as Manager -> `200 OK` (Returns the active Predefined Pizzas)
  - List without filter, as Employee -> `200 OK`
  - Search by the product name, as Employee -> `200 OK` (Returns the created pizza)
  - Search without results -> `200 OK` (Returns `[]`)
  - Empty `name` -> `400 Bad Request` (Blocked by Joi validation)
