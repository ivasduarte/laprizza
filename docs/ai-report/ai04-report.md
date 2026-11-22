# AI04 - IARTI Technical Report

## AI01 - Prolog Bill of Materials and Stock Requirements

### 1. Data and simulated inputs

- The calculation uses only the planning snapshot of the back end (`GET /api/v2/ai-data/snapshot?scenarioId&stockMode`, AI06): products, sizes, the BOM of each pizza and size in abstract stock units, the aggregates, the stock and the ordered pizzas.
- **Aggregates** belong to the product and are classified by the back end as **produced** (with items and quantities, e.g. dough = 2 flour + 1 water + 1 yeast) or **purchased** (no composition, e.g. sauce). Only one level is allowed, so recipes cannot be cyclic.
- **AI scenarios** hold the simulated orders and, optionally, a simulated stock. No ordering workflow is needed, and the calculation is independent of pending or confirmed orders.
- **Stock mode:** `live` uses the real stock at the time of the execution; `scenario` uses the stock stored in the scenario, for reproducible evaluations. Both follow the same rules and format, so real and simulated data can replace each other without changing the calculation.
- Every result identifies the scenario (`id`, `name`, `version`, `stockMode`) and the inputs (`snapshotId`, origin and version of the catalogue, stock and orders), and is marked `simulation: true`.

### 2. Calculation rules (`bom.pl`)

1. **Validation first.** Unknown or non-predefined pizzas, sizes not allowed, incomplete recipes (missing or invalid consumptions, unknown components, a produced aggregate without a measured consumption) and missing stock entries are all reported together. With any problem there is no calculation: `422 AI_INVALID_DATA`, without quantities.
2. **Direct demand:** ordered quantity × consumption of each component for that pizza and size.
3. **Pass 1, aggregates:** the stock of the aggregate is used first. Only the missing part of a **produced** aggregate is expanded into its ingredients; the missing part of a **purchased** aggregate is a replenishment need.
4. **Pass 2, simple products:** each one is counted once, with its direct demand plus the demand derived from the produced aggregates.

This avoids counting both an aggregate and the ingredients it already represents.

### 3. Results

| Field | Content |
| --- | --- |
| `items` | Per product: required (direct and from aggregates), available, used, hypothetical remaining stock (never negative) and shortage |
| `shortages` | Replenishment needs of the stock-controlled products that are not produced internally |
| `production` | Produced aggregates to make, and whether their ingredients are available |
| `feasible` | `true` when there is no shortage; a shortage is a result, not an error |
| `warnings` | Non-blocking remarks (e.g. a component without stock control or consumption) |

### 4. Demonstration (initial data and expected results)

The demo seed (`npm run seed:ai01-demo -- --confirm`) creates the `[Demo]` products, pizzas, real stock and four scenarios. Running it again resets them.

| Scenario | Order | Stock of the scenario | Expected result |
| --- | --- | --- | --- |
| `DEMO-BASIC` | 3 Funghi Simples M | Base 5, Mozzarella 6, Mushrooms 4 | Feasible; only simple products |
| `DEMO-SUFFICIENT` | 2 Margherita M + 1 Prosciutto M | Dough 5, Sauce 5, Mozzarella 10, Ham 3, Mushrooms 3 | Feasible; the dough comes from stock (remaining 2), no ingredients needed |
| `DEMO-INSUFFICIENT` | 2 Prosciutto L + 1 Margherita M + 1 Funghi Simples L | Dough 0, Sauce 2, Mozzarella 5, Ham 4, Mushrooms 1, Base 1 | Not feasible: replenish sauce 3, mozzarella 6, mushrooms 5, base 1; produce 5 doughs (flour 10) |
| `DEMO-PARTIAL` | 3 Margherita M | Dough 1, Sauce 5, Mozzarella 4 | Not feasible: 1 dough from stock, **only 2 produced** (flour 4, not 6); mozzarella short 2, remaining 0 |

### 5. Calculation separate from stock

- Calculations only read the knowledge base. Balances are results only: the real stock and the stock of the scenarios are never changed, and no purchase order is created.
- The real stock changes only through an explicit stock operation of the back end (BCK09).
- The automated flow `bom-demo-test-flow.http` checks the four scenarios and that the real stock is the same before and after a `live` calculation.

## AI03 - Artificial Neural Networks Study

The study looked at how artificial neural networks could support LaPrizza's management. Three applications were analysed:

- **A - Demand forecasting** per product and size (regression). It would propose the daily forecasts that the Prolog Requirements Planning uses.
- **B - Stock-shortage risk** (classification). It would flag products likely to run short.
- **C - Preparation and waiting time** (regression). It would estimate durations for the scheduler.

The study also covered data quality (no real sales history yet, abstract units, catalogue changes, no customer data), evaluation (MAE/RMSE for regression, precision/recall/F1 for classification, comparison with a simple baseline) and risks (black-box predictions, invalid outputs, false alarms). The conclusion is that **A is the most promising**, but only once real data exist, and always as an advisory tool reviewed by the Manager. Generative AI (Claude, Gemini) was used for structure and wording, and its output was checked against the requirements and rewritten by the team.

## AI05 - Artificial Intelligence Service Access

### 1. Endpoints

The SPA never calls Prolog directly. It calls the back end, and the back end calls the Prolog service with its own service identity.

| Layer | Endpoint | Caller and credential | Purpose |
| --- | --- | --- | --- |
| Back end | `POST /api/v2/planning/bom` | SPA, Manager token (`planning:execute`) | Bill of Materials of the AI scenario |
| Back end | `POST /api/v2/planning/requirements` | SPA, Manager token | Requirements planning of a forecast with a supplier scenario |
| Back end | `GET /api/v2/planning/runs[/{id}]` | SPA, Manager token | Saved results with their input versions |
| Prolog | `POST /service/bom`, `POST /service/requirements` | Back end, `X-Api-Key` (service identity) | Calculation with the snapshot sent in the body (push) |
| Prolog | `POST /bom`, `POST /requirements` | Client with a Manager token, forwarded to the back end | Direct calls for tests and demos (pull) |
| Prolog | `GET /health` | None | Liveness |

The back-end routes are documented in OpenAPI (`/api/v2/docs`). The Prolog routes, with representative requests, responses and errors, are documented in `docs/flows/ai-service-access/service-interface.md`.

### 2. Requests and results

- The request is `{ scenarioId, stockMode }`, plus `forecastId` and `supplierScenarioId` for the requirements calculation. `scenarioId` is the code of an AI scenario. The other ids are the MongoDB ids of the back end.
- The BOM result has `orders`, `items` (required, available, used, remaining, shortage), `shortages`, `production` and `warnings`. The requirements result adds the daily `requirements` and `purchases`, with the chosen supplier, price, arrival date and unmet quantities.
- Every result carries `simulation: true`, `scenario` and `inputs { snapshotId, sources }`, so each quantity can be traced to the exact data it came from. The back end adds the `runId` of the saved run.

### 3. Validation and outcomes

| Outcome | Answer | Shown by the SPA |
| --- | --- | --- |
| Successful calculation | `200`, `status: "ok"` (shortages give `feasible: false`, which is still a success) | Result tables and warnings |
| Invalid input | `400 VALIDATION_ERROR` / `SCENARIO_WITHOUT_STOCK`, `404 AI_SCENARIO_NOT_FOUND` / `FORECAST_NOT_FOUND` | Error next to the field |
| Missing information | `422 AI_INVALID_DATA` with `details.problems` (e.g. `MISSING_SCENARIO_STOCK`, `INCOMPLETE_RECIPE`, `MISSING_FORECAST`) | List of problems with the product or pizza ids |
| Service unavailable | `503 AI_SERVICE_UNAVAILABLE` (`details.reason`, `Retry-After: 5`), `504 AI_SERVICE_TIMEOUT` | "Service unavailable", with a retry hint |

The same rules are checked in the SPA (`validatePlanningInput`), in the back end (Joi) and in Prolog (`validate_input/3`, plus the validation of the whole snapshot). Missing data are reported, never replaced by defaults.

### 4. Access control

- Back end: `requirePermission(planning:execute)`, granted only to MANAGER. Without a token the answer is 401, and an Employee, Customer or Administrator gets 403.
- Prolog, push path: the key must be equal to `AI_SERVICE_KEY`. Without a configured key the routes are closed, and a user token is not accepted as a service identity (`401 SERVICE_UNAUTHORIZED`).
- Prolog, pull path: the token is forwarded to the back end, which applies the same permission. The token is never logged.
- The Prolog service listens only on `127.0.0.1`.

### 5. No silent changes

Calculations only read the knowledge base. Stock balances, production and purchases are results only. The only write is the planning run of a successful calculation, which the back end saves in its own collection. A stock change or a purchase order is always an explicit action through the responsible back-end functionality (for example the stock endpoints of BCK09). The httpyac flows check that the real stock and the scenario stock are unchanged after the calculations.

### 6. Demonstration in the common solution

With the back end, the Prolog service and the AI01 demo seed running:

1. Log in as Manager and open `/ai` → Execution.
2. Choose "Bill of Materials", scenario `DEMO-PARTIAL` and "Scenario stock", then execute. The result shows the mozzarella shortage and the dough to produce.
3. Choose "Requirements" with a forecast and a supplier scenario, then execute. The result shows the daily needs and the purchases by supplier.
4. Stop the Prolog service and execute again. The page reports that the service is unavailable.

The same cases are automated in `bom-demo-test-flow.http` (pull path) and `planning-test-flow.http` (push path).

## AI06 - Back-End Data and Prolog Knowledge Base

### 1. Back-end data source

- Prolog gets all business data from one JSON document, the _planning snapshot_, built only by the back end at `GET /api/v2/ai-data/snapshot?scenarioId&stockMode` (Manager only, `planning:execute`). It has no direct database access and no customer data.
- The snapshot contains products, sizes, BOM per pizza and size, aggregates (production/purchase), stock (live or scenario), the simulated order, the forecast and the supplier offers (price EUR, stock units, lead time, optional limit).
- `meta` records `snapshotId`, `retrievedAt`, `simulated` and the origin/version of each input.
- Missing or invalid values are reported in `issues[]`, never defaulted.
- The snapshot reaches Prolog by **push** (the back end sends it to `/service/*` with `X-Api-Key`) or **pull** (Prolog fetches it with the Manager's token).

### 2. Construction and refresh of the knowledge base

- `kb.pl` turns the snapshot into facts: `product/4`, `bom_item/4`, `aggregate/2`, `aggregate_item/3`, `stock/2`, `ordered_item/4`, `forecast_item/5`, `supplier_offer/5`, `supplier_limit/3`.
- The whole snapshot is validated first. Problems such as `UNKNOWN_ITEM`, `NESTED_AGGREGATE` or `INVALID_QUANTITY` are all returned together, and nothing is loaded.
- Refresh policy: one snapshot per calculation. `with_snapshot/2` loads it under a mutex and in a transaction, runs the calculation and always clears the KB. Scenario snapshots are never cached.
- Any simulated input makes the result `simulation: true`.

### 3. Examples

| Case                                                  | Result                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Valid request (Manager, existing scenario)            | `200` + snapshot                                           |
| Invalid query (e.g. `stockMode` without `scenarioId`) | `400 BAD_REQUEST`, nothing read                            |
| No token / Employee                                   | `401` / `403`                                              |
| Unknown scenario / scenario without stock             | `404 AI_SCENARIO_NOT_FOUND` / `400 SCENARIO_WITHOUT_STOCK` |
| Invalid data in the snapshot                          | `422 AI_INVALID_DATA`, KB not loaded                       |
| Back end down / no answer (pull)                      | `503 AI_DATA_UNAVAILABLE` / `504 AI_DATA_TIMEOUT`          |

### 4. Calculations, stock and purchase orders

Calculations only read the KB, and their balances are results only. Stock and purchase orders belong to the back end and only change through an explicit confirmation. The only thing written after a calculation is the planning-run record (`snapshotId`, `bomVersion` and input versions).
