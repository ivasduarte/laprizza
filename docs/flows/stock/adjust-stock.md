# UC3: Adjust Stock

## 1. Domain Assumptions

- The stock of a product can be adjusted using an `increase` or `decrease` operation.
- The `amount` provided must be a strictly positive integer (> 0).
- A `decrease` operation cannot result in a negative stock quantity.
- The Product must exist and must be designated as `stockControlled: true`.
- **Auto-initialization:** Similar to querying, if the stock record does not exist yet, it is created with `quantity: 0` before applying the adjustment operation.
- Users with both `MANAGER` and `EMPLOYEE` roles are authorized to adjust stock.

## 2. Solution Design

![adjust-stock](./diagrams/adjust-stock.svg)

## 3. Business Test Planning

- **Isolation Strategy:** All application tests use dependency injection via isolated in-memory Dummies, avoiding Mocking libraries entirely.
- **Domain Tests (`stock.domain.test.js`):**
  - `validateStockChange rejects negative amounts, zero, decimals, and non-numbers`
  - `validateStockChange accepts strictly positive integers`
  - `validateStockQuantity rejects negative integers and accepts non-negative integers`
- **Application Tests (`stock.service.test.js`):**
  - `adjustStock successfully increases stock quantity`
  - `adjustStock successfully decreases stock quantity`
  - `adjustStock throws 400 AppError if a decrease results in a negative quantity`
  - `adjustStock throws 400 AppError if the product is not stock-controlled`
  - `adjustStock throws 404 AppError if the product does not exist`
  - `adjustStock auto-creates a stock record before applying the adjustment if missing`

## 4. Postman E2E Tests

- **Base Endpoint:** `PATCH /api/v1/stock/:productId`
- **Validated Scenarios:**
  - Request without Bearer Token -> `401 Unauthorized`
  - Request with `CUSTOMER` Bearer Token -> `403 Forbidden` (RBAC enforcement)
  - Empty payload or missing `amount`/`operation` -> `400 Bad Request` (Joi validation)
  - Invalid `operation` string (e.g., 'add') -> `400 Bad Request`
  - Negative or zero `amount` -> `400 Bad Request`
  - Invalid Product ID format -> `400 Bad Request`
  - Adjustment resulting in negative stock -> `400 Bad Request`
  - Product not stock-controlled -> `400 Bad Request`
  - Non-existent Product ID -> `404 Not Found`
  - Valid `increase` or `decrease` operation -> `200 OK`
