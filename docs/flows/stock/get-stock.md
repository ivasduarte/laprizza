# UC2: Get Stock by Product ID

## Use Case View

**Primary Actor:** Manager / Employee <br>
**Description:** Allows an authenticated manager or employee to query the stock level of an individual stock-controlled product.

**Preconditions:**

- The user must be authenticated with the `MANAGER` or `EMPLOYEE` role.
- The requested product must exist and be stock-controlled.

**Main Success Scenario:**

1. The user provides a product ID.
2. The System validates the MongoDB ObjectId format.
3. The System verifies the product exists and is designated as stock-controlled.
4. The System retrieves the stock record.
5. If no stock record exists yet, the System auto-initializes a new record with `quantity: 0`.
6. The System returns the stock details via a DTO with a 200 OK status.

**Alternative Flows:**

- _Invalid Product ID format or not stock-controlled:_ The System returns a 400 Bad Request error.
- _Non-existent Product ID:_ The System returns a 404 Not Found error.
- _Unauthorized user (`CUSTOMER` or no token):_ The System returns a 401 Unauthorized or 403 Forbidden error.

**Postconditions:**

- If the stock record was missing, it is created with a zero quantity.

## 1. Domain Assumptions

- Stock is queried individually by its associated `productId`.
- The Product must exist and must be designated as `stockControlled: true`.
- **Auto-initialization:** If the product is stock-controlled but a stock record does not yet exist in the database, a new record with `quantity: 0` is automatically created and returned.
- The ID must conform to the MongoDB ObjectId format.
- Users with both `MANAGER` and `EMPLOYEE` roles can view stock details.

## 2. Solution Design

![get-stock](./diagrams/get-stock.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies (`stock.dummy.repository.js` and `products.dummy.repository.js`), avoiding Mocking libraries entirely.
- **Application Tests (`stock.service.test.js`):**
  - `getStockByProductId returns the stock record for a valid stock-controlled product`
  - `getStockByProductId throws 404 AppError if the product does not exist`
  - `getStockByProductId throws 400 AppError if the product is not stock-controlled`
  - `getStockByProductId auto-creates a stock record with 0 quantity if it does not exist yet`

## 4. Postman E2E Tests

- **Base Endpoint:** `GET /api/v1/stock/:productId`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `CUSTOMER` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Request with invalid Product ID format -> `400 Bad Request` (Joi CastError prevention)
  - Request for a product that is not stock-controlled -> `400 Bad Request`
  - Request for a non-existent Product ID -> `404 Not Found`
  - Request for a valid stock-controlled Product ID -> `200 OK` (Returns stock DTO)
