# UC2: List and Search Allergens

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows an authenticated user to list all active allergens or search for specific active allergens by a partial name.

**Preconditions:**

- The user must be authenticated and have the `MANAGER` or `EMPLOYEE` role.

**Main Success Scenario:**

1. The User requests the list of allergens, optionally providing a search query (name).
2. The System queries the database for active allergens. If a name is provided, it filters for allergens containing that text (case-insensitive).
3. The System maps the found active entities to DTOs.
4. The System returns the sorted list of allergens with a 200 OK status.

**Alternative Flows:**

- _No matching allergens found:_ The System returns an empty list `[]` with a 200 OK status.
- _Invalid query (e.g., empty or repeated name format):_ The System throws a 400 Bad Request error.

**Postconditions:**

- None (Read-only operation).

## 1. Domain Assumptions

Due to a lack of client clarification, the following domain restrictions were assumed in the code:

- Only active allergens are listed; deactivated allergens are never returned;
- The list is sorted by name and is not paginated;
- The search is partial and case-insensitive: the text may appear anywhere in the name, and special characters are treated as plain text.

## 2. Solution Design

![UC2_List_and_Search_Allergens](diagrams/list-search-allergens.svg)

## 3. Business Test Planning

- All unit tests use isolated in-memory Dummy Repositories (`allergens.dummy.repository.js`). The Mockito library isn't used in this project.
- **Scenario A:** Request the list when active and deactivated allergens exist. Result: Only the active allergens are returned, mapped to `{ id, name, isActive }`.
- **Scenario B:** Request the list with a `name` filter. Result: Only the active allergens whose name contains the text (ignoring letter case) are returned.
- **Scenario C:** Request the list with a `name` that matches no allergen. Result: An empty list is returned (200 OK).

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/allergens[?name=]`
- **Validated Scenarios:**
  - List without filter -> `200 OK` (Returns the active allergens)
  - Partial search by name -> `200 OK`
  - Search without results -> `200 OK` (Returns `[]`)
  - Search with regex characters (`?name=.*`) -> `200 OK` (Returns `[]`, treated as text)
  - Empty or repeated `name` -> `400 Bad Request` (Blocked by Joi validation)
  - After deactivating an allergen -> `200 OK` (The deactivated allergen is no longer listed)
  - Missing or invalid token -> `401 Unauthorized`
