# UC2 - List / Search Pizza Component Type

## Use Case View

**Primary Actor:** Manager <br>
**Description:** Allows a manager to list all active pizza component types sorted by assembly order, search for a specific type by its exact name, or retrieve details using its ID.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` role.

**Main Success Scenario:**

1. The Manager requests the list of component types, optionally providing an exact name query or an ID in the URL.
2. The System validates the query parameters and ID format.
3. The System queries the database:
   - If no name is provided, returns all active types sorted by assembly order.
   - If an exact name is provided, returns the matching type (even if inactive/removed, flagged accordingly).
   - If an ID is provided, returns the specific type details.
4. The System returns the requested data as DTOs with a 200 OK status.

**Alternative Flows:**

- _Partial or blank name search:_ The System returns an empty list `[]` with a 200 OK status.
- _Unknown ID:_ The System throws a 404 Not Found error.
- _Invalid ID format:_ The System throws a 400 Bad Request error.
- _Request by unauthorized user:_ The System throws a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

- Listing without filter returns active types, sorted by assembly order;
- A type can be searched by its exact name;
- A partial or blank name returns an empty list;
- A type can be consulted by its identifier;
- The maximum quantity is an integer greater than or equal to 1, or unbounded, and cannot be lower than the minimum quantity;
- Only users with the `MANAGER` role are authorized to list or search a pizza component type.

## 2. Solution Design

![List/Search Pizza Component Types Design](./diagrams/list-search-pizza-component-type-design.svg)

## 3. Business Test Planning

- **Issolation Strategy:** All application tests use dependency injection via isolated in-memory dummies (`pizza-component-type.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`pizza-component-type.service.test.js`):**
  - `listPizzaComponentTypes without a name returns the active types sorted by assembly order`
  - `listPizzaComponentTypes without a name does not return removed types`
  - `listPizzaComponentTypes finds the exact name ignoring case and accents`
  - `listPizzaComponentTypes finds a removed type by name and flags it as inactive`
  - `listPizzaComponentTypes returns an empty list for partial or blank names`
  - `getPizzaComponentTypeById returns the type or throws 404`
  - `getPizzaComponentTypeById also returns a removed type, flagged as inactive`

## 4. E2E Tests

- **Base Endpoint:** `GET /api/v1/pizza-component-type`
- **Validated Scenarios:**
  - Request with Bearer Token -> `401 Unauthorized`
  - Request with `EMPLOYEE` Bearer Token -> `403 Forbidden` (RBAC Enforcement)
  - List by `MANAGER` -> `200 OK`
  - Search by exact name -> `200 OK`
  - Search by partial, blank or unkown name -> `200 OK` with `[]`
  - Get by id -> `200 OK`
  - Get with unkown id -> `404 Not Found`
  - Get with invalid id -> `400 Bad Request`
