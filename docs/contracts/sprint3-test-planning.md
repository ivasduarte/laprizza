# Sprint 3 Test Planning

## 1. Regression Baseline (Sprints 1 and 2)
Guarantee that Sprint 3 integration doesn't break the already existing functionalities.

- **Authentication & Session:** Login (local and OIDC), token refresh, session, revocation, and profile-based permission validation (`CUSTOMER`, `EMPLOYEE`, `MANAGER`).
- **Catalog & Stock:** CRUD of products, sizes, components, and quantity rules (`minQuantity` / `maxQuantity`).
- **Kitchen Setup & 3D Base:** CRUD `AssemblyLineConfiguration` and validation of element coordinates/dimensions.
- **Baseline Planning:** Execution of existing planning algorithms without regression on the response formats.
- **Passing Criteria:** 100% of unit tests and HTTP suites `htttpyac` from Sprints 1 and 2 must pass CI before any merge into `main`.


## 2. End-To-End (E2E) Scenarios for Sprint 3
Continuous flow from order entry to completion on the assembly line:

| ID | E2E Scenario | Steps / Endpoints | Expected Result |
|:---|:-------------|:------------------|:----------------|
| E2E-01 | Full Nominal Flow | 1. `POST /orders` (with `Idempotency-Key`) <br> 2. `POST /planning/schedule` <br> 3. `POST /execution/start` <br> 4. Sequence of `POST /execution/{id}/events` (`ITEM_SPAWNED` → `EXECUTION_COMPLETED`) <br> 5. `GET /orders/{id}` | Order created with `pizzaItems`, plan generated, events processed in order, and final order status updated to `COMPLETED`. |
| E2E-02 | 3D Viewer Synchronization | 1. Start execution (`POST /execution/start`) <br> 2. Broadcast station events (`STATION_STARTED`, `STATION_COMPLETED`) <br> 3. Consult (`GET /execution/{id}/state`) | The returned state accurately reflects the current season of each `pizzaItemId`, the occupacy status of each `resouceId`, and the `lastEventSequence`. |
| E2E-03 | Stock Validation in Intake | 1. Submit `POST /orders` a quantity exceeding the available stock. | Immediate rejection without `422 INSUFFICIENT_STOCK` creating an order or partially reducing stock. |