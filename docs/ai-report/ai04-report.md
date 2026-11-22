# AI04 - IARTI Technical Report

This report documents the Artificial Intelligence work of Sprint 2: the Bill of Materials module (AI01), the Requirements Planning and supplier selection module (AI02), the artificial neural networks study (AI03), the service endpoints (AI05) and the back-end data and Prolog knowledge base (AI06).

| Item | Location |
| --- | --- |
| Prolog code | `ai-scheduling/` (`kb.pl`, `bom.pl`, `requirements.pl`, `server.pl`) |
| Prolog tests | `ai-scheduling/test/*.plt` (`./run-tests.sh`, SWI-Prolog >= 9) |
| Demonstration fixtures | `ai-scheduling/fixtures/*.json`, `ai-scheduling/sample-snapshot.json` |
| End-to-end flows | `backend/test-flows/bom-demo-test-flow.http`, `planning-test-flow.http`, `ai-data-test-flow.http` |
| Interface documentation | [AI Service Interface](../flows/ai-service-access/service-interface.md), OpenAPI `/api/v2/docs` |
| Neural networks study | [AI03 report](../artifical-neural-networks/report.md) |

## Contents

1. [Calculations, stock changes and purchase orders](#1-calculations-stock-changes-and-purchase-orders)
2. [Assumptions](#2-assumptions)
3. [AI01 - Bill of Materials and stock requirements](#3-ai01---bill-of-materials-and-stock-requirements)
4. [AI02 - Requirements Planning and supplier selection](#4-ai02---requirements-planning-and-supplier-selection)
5. [AI03 - Artificial neural networks study](#5-ai03---artificial-neural-networks-study)
6. [AI05 - Service endpoints](#6-ai05---service-endpoints)
7. [AI06 - Back-end data sources and knowledge base](#7-ai06---back-end-data-sources-and-knowledge-base)
8. [Prolog execution examples](#8-prolog-execution-examples)
9. [Tests and evidence](#9-tests-and-evidence)
10. [Limitations](#10-limitations)
11. [References](#11-references)
12. [Use of AI-generated content](#12-use-of-ai-generated-content)

## 1. Calculations, stock changes and purchase orders

The three are kept apart. Only the back end owns stock and purchase-order records.

| Concept | Who | What changes | How |
| --- | --- | --- | --- |
| **Calculation** (BOM, Requirements Planning) | Prolog service, called through the back end | Nothing. Balances, "hypothetical remaining stock", production and purchase proposals are results only (`simulation: true`) | `POST /api/v2/planning/bom`, `POST /api/v2/planning/requirements` |
| **Planning run** | Back end | One record with the inputs and the result of a successful calculation (ADR-0047) | Saved by the back end after a `200`; consulted with `GET /api/v2/planning/runs[/{id}]` |
| **Stock change** | Back end | The stored stock of a product | Only an explicit stock operation of the Manager: `PATCH /api/v2/stock/{productId}` (BCK09/WEB05). A calculation never calls it, so a consumption cannot be deducted twice |
| **Purchase-order confirmation** | Back end | Nothing in Sprint 2 | No purchase-order record exists yet. Purchase proposals are never turned into orders automatically; a future confirmation will be a separate, explicit back-end operation. Repeating a calculation therefore cannot create duplicate orders |

No endpoint of the AI service writes stock or purchase orders. The knowledge base only holds copies loaded for one calculation and is cleared afterwards (section 7.3). The flows `bom-demo-test-flow.http` and `planning-test-flow.http` read the real stock and the scenario stock before and after the calculations and check that they are unchanged.

## 2. Assumptions

| # | Assumption | Consequence |
| --- | --- | --- |
| A1 | Every quantity uses the abstract stock unit of its product. The back end exports one unit for all products (`stockUnit: "abstract stock unit"`, `ai-data.service.js`) | Needs, stock and offers are compared directly; no unit conversion |
| A2 | Aggregates have one level: an aggregate is either **produced** (items and quantities) or **purchased** (no composition) | Recipes cannot be cyclic; nested aggregates are rejected (`NESTED_AGGREGATE`) |
| A3 | No ordering workflow exists. AI01 uses the simulated orders of an AI scenario; AI02 uses a forecast as the demand | Pending or confirmed operational orders are not considered |
| A4 | Missing data are never replaced by defaults | Any missing or invalid input blocks the calculation with `422 AI_INVALID_DATA` |
| A5 | Prices are in EUR. An offer is a price for `stockUnits` units | Unit price = `priceEur / stockUnits`; no currency conversion |
| A6 | Costs are pro rata: no rounding to whole offers and no minimum order | The cost of an allocation is unit price x quantity |
| A7 | `supplyLimit` is the total a supplier can deliver for a product over the whole plan | Without a limit the capacity is not verified (section 4.5) |
| A8 | Purchases are placed on the planning reference date; a daily need is due at the start of its day; lead times are calendar days (`ceiling(leadTimeDays)`) | An offer is on time when it arrives on or before the day of the need |
| A9 | A forecast line without a size is a directly sold product, consumed 1:1 in its own stock units | A forecast line with a size is a pizza and goes through the BOM |
| A10 | Any simulated input (scenario orders, scenario stock, supplier offers) makes the whole calculation a simulation | Every result carries `simulation: true` |

## 3. AI01 - Bill of Materials and stock requirements

### 3.1 Data and simulated inputs

- The calculation uses only the planning snapshot of the back end (section 7): products, sizes, the BOM of each pizza and size in abstract stock units, the aggregates, the stock and the ordered pizzas.
- **AI scenarios** hold the simulated orders and, optionally, a simulated stock (ADR-0041).
- **Stock mode:** `live` uses the real stock at the time of the execution; `scenario` uses the stock stored in the scenario, for reproducible evaluations. Both follow the same rules and format, so real and simulated data can replace each other without changing the calculation.
- Every result identifies the scenario (`id`, `name`, `version`, `stockMode`) and the inputs (`snapshotId`, origin and version of the catalogue, stock and orders).

### 3.2 Calculation rules (`bom.pl`)

1. **Validation first.** Unknown or non-predefined pizzas (`NOT_PREDEFINED_PIZZA`), sizes not allowed (`INVALID_SIZE`), incomplete recipes (`INCOMPLETE_RECIPE`), a scenario that does not match the request (`SCENARIO_MISMATCH`) and stock-controlled items without a stock entry (`MISSING_SCENARIO_STOCK` / `MISSING_STOCK`) are all reported together. With any problem there is no calculation: `422 AI_INVALID_DATA`, without quantities.
2. **Direct demand:** ordered quantity x consumption of each component for that pizza and size.
3. **Pass 1, aggregates:** the stock of the aggregate is used first. Only the missing part of a **produced** aggregate is expanded into its ingredients; the missing part of a **purchased** aggregate is a replenishment need.
4. **Pass 2, simple products:** each one is counted once, with its direct demand plus the demand derived from the produced aggregates.

Pass 2 counts each product once, so an aggregate and the ingredients it already represents are never both counted (ADR-0040).

### 3.3 Results

| Field | Content |
| --- | --- |
| `items` | Per product: `required` (`requiredDirect` + `requiredFromAggregates`), `available`, `used`, `remaining` (never negative) and `shortage` |
| `shortages` | `replenishmentNeeded` of the stock-controlled products that are not produced internally |
| `production` | Produced aggregates to make (`toProduce`), `canProduce` and `missingIngredients` |
| `feasible` | `true` when there is no shortage; a shortage is a result, not an error |
| `warnings` | Non-blocking remarks (e.g. `PIZZA_STOCK_IGNORED`) |

### 3.4 Demonstration: initial data and expected results

The demo seed (`npm run seed:ai01-demo -- --confirm`) creates the `[Demo]` products, pizzas, real stock and four scenarios. Running it again resets them, so the scenarios are reproducible. The same data are in `ai-scheduling/fixtures/demo-*.json`.

| Scenario | Order | Stock of the scenario | Expected result |
| --- | --- | --- | --- |
| `DEMO-BASIC` | 3 Funghi Simples M | Base 5, Mozzarella 6, Mushrooms 4 | Feasible; only simple products |
| `DEMO-SUFFICIENT` | 2 Margherita M + 1 Prosciutto M | Dough 5, Sauce 5, Mozzarella 10, Ham 3, Mushrooms 3 | Feasible; the dough comes from stock (remaining 2), no ingredients needed |
| `DEMO-INSUFFICIENT` | 2 Prosciutto L + 1 Margherita M + 1 Funghi Simples L | Dough 0, Sauce 2, Mozzarella 5, Ham 4, Mushrooms 1, Base 1 | Not feasible: replenish sauce 3, mozzarella 6, mushrooms 5, base 1; produce 5 doughs (flour 10) |
| `DEMO-PARTIAL` | 3 Margherita M | Dough 1, Sauce 5, Mozzarella 4 | Not feasible: 1 dough from stock, **only 2 produced** (flour 4, not 6); mozzarella short 2, remaining 0 |

### 3.5 Calculation evidence: `DEMO-PARTIAL` (aggregate partly in stock)

Recipe of Margherita M: 1 dough (produced: 2 flour + 1 water + 1 yeast), 1 sauce (purchased), 2 mozzarella.

| Product | Kind | Required | Available | Used | Remaining | Shortage | Calculation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dough | produced | 3 | 1 | 1 | 0 | 2 | 3 x 1; stock first, 2 produced |
| Sauce | purchased | 3 | 5 | 3 | 2 | 0 | 3 x 1 |
| Mozzarella | simple | 6 | 4 | 4 | 0 | **2** | 3 x 2 |
| Flour | ingredient | 4 | - | - | - | - | 2 produced doughs x 2 (**not** 3 x 2) |
| Water / Yeast | ingredient | 2 / 2 | - | - | - | - | 2 x 1 |

Result: `feasible: false`, `shortages: [mozzarella 2]`, `production: [dough 2, canProduce: true]`. Water and yeast have no stock control in the demo, so they never block production. These values are asserted by `test(demo_partial_only_missing_aggregates_are_expanded)` in `test/bom.plt`.

## 4. AI02 - Requirements Planning and supplier selection

### 4.1 Input

A forecast version (daily quantities of sellable products; pizzas with a size), the BOM and stock rules of AI01, the stock (live or scenario) and the confirmed supplier scenario (offers: supplier, price in EUR, stock units, lead time in days, optional supply limit). Forecasts and supplier scenarios are immutable and versioned (ADR-0046).

### 4.2 Algorithm (`requirements.pl`)

1. **Gross demand** per day and product through the BOM; a forecast line without a size is the direct demand of a directly sold product.
2. **Produced aggregates** use their stock first; the rest is produced and expanded into ingredients (as in AI01).
3. **Net need per day:** stock is consumed chronologically. The need of a day is what the cumulative demand exceeds the stock by, minus what was already short on earlier days (`net_series/3`). Planned deliveries and hypothetical balances never change stored stock.
4. **Purchase plan** per product (section 4.4).

### 4.3 Planning reference date

- Purchases are placed on the reference date: the snapshot day (`meta.retrievedAt`, i.e. the execution date) or an explicit `today(Date)` option for historical simulations. It is returned as `plan.referenceDate` and shown by the SPA ("Planning reference date").
- Every proposed order is placed on `plan.referenceDate`, so no order date precedes it. The allocations carry `forDate` (the day of the need) and `arrivalDate`; they have no separate order-date field because it is the same for all of them.
- A daily need is due at the start of its day. An offer arrives `ceiling(leadTimeDays)` calendar days after the reference date and is on time when `arrivalDate <= forDate`.

### 4.4 Supplier selection criteria and rationale

The decision and the alternatives considered are recorded in [ADR-0058](../adr/0058-requirements-planning-with-chronological-net-needs-and-on-time-cheapest-supplier.md); the flows are in [AI Requirements Planning](../flows/ai-requirements-planning/README.md).

| Pass | Needs | Choice | Why |
| --- | --- | --- | --- |
| 1 - on time | Every need, earliest first | Cheapest unit price among the offers that arrive on time; ties by earliest arrival, then supplier id | Meeting the date is a hard requirement; among the offers that meet it, cost is minimized. Serving the earliest need first is also the cheapest, because an offer on time for an earlier need is also on time for a later one |
| 2 - late | Needs still open, with the capacity left | Earliest arrival first, then cheapest | When no offer is on time, the shortest delay matters more than the price. These lines are flagged `onTime: false` |

Pass 2 only uses capacity that pass 1 did not need, so a late delivery never takes the place of an on-time one (`test(late_capacity_does_not_take_the_place_of_an_on_time_need)`).

Each product gets a status: `on_time`, `late` (covered, some lines late), `partial` (part uncovered) or `unavailable` (nothing covered). Uncovered quantities are listed in `unmet` with the reason `NO_SUPPLIER_OFFER` or `INSUFFICIENT_SUPPLY`. `summary.feasible` is `true` only if every product is `on_time`. Without a supplier scenario every product is `unavailable`, with the warning `NO_SUPPLIER_SCENARIO`.

**Price and cost.** Offers are compared on a common stock-unit basis: `unitPriceEur = priceEur / stockUnits`. The cost of an allocation is `unitPriceEur x quantity`. `summary.totalCostEur` gives the period total.

**Units.** All products share one abstract stock unit (assumption A1), so offers and needs are always in the same unit. Incompatible units cannot occur with the current data model and are therefore not flagged (section 10).

### 4.5 Capacity assumptions

- `supplyLimit`, when present, is the total a supplier can deliver of the product over the whole plan, across all days. `0` means no capacity.
- Without a limit the capacity is **not verified**: it is neither read as zero nor as verified unlimited availability. The calculation takes it as unbounded and flags every such allocation with `capacityStated: false`, so the Manager can see which lines rely on unconfirmed supply.

### 4.6 Calculation evidence (`sample-snapshot.json`)

Forecast `fc-week-1` (2026-11-02 to 2026-11-04): 40 Margherita M on 11-02; 55 Margherita M and 20 Prosciutto L on 11-03; 15 Margherita S on 11-04. Reference date 2026-11-02.

**Net needs.**

| Product | Stock | Gross demand 11-02 / 11-03 / 11-04 | Net need 11-02 / 11-03 / 11-04 |
| --- | --- | --- | --- |
| Dough (produced) | 50 | 40 / 75 / 15 | 0 / **65** / **15** to produce (cumulative 40, 115, 130 against 50) |
| Flour (from dough, 150 each) | 5000 | 0 / 9750 / 2250 | 0 / 4750 / 2250 |
| Mozzarella (120 M, 160 L, 80 S) | 3000 | 4800 / 9800 / 1200 | 1800 / 9800 / 1200 |
| Ham (60 per Prosciutto L) | 500 | 0 / 1200 / 0 | 0 / 700 / 0 |

Only the 80 doughs that are produced are expanded into flour: the 50 in stock are not counted again.

**Offers and choices.**

| Product | Offers (unit price, arrival) | Allocation | Status | Cost |
| --- | --- | --- | --- | --- |
| Ham | sup-a 9/50 = 0.18, arrives 11-03 | 700 for 11-03, on time | `on_time` | 126.00 EUR |
| Mozzarella | sup-a 12.5/100 = 0.125, arrives 11-04, no limit; sup-b 11.9/100 = 0.119, arrives 11-06, limit 500 | Pass 1: 1200 for 11-04 from sup-a (on time). Pass 2: 1800 for 11-02 and 9800 for 11-03 from sup-a (earliest arrival, late) | `late` | 12800 x 0.125 = 1600.00 EUR |
| Flour | sup-b 8/1000 = 0.008, arrives 11-05 | 4750 for 11-03 and 2250 for 11-04, late | `late` | 7000 x 0.008 = 56.00 EUR |
| Tomato, mushrooms | none | - | `unavailable`, `NO_SUPPLIER_OFFER` | - |

`summary`: 6 products to buy, `totalCostEur: 1782`, `feasible: false`. The mozzarella lines of sup-a carry `capacityStated: false`.

With the reference date 2026-10-29 every mozzarella need can be met on time, and the cheapest on-time offer wins: sup-b gives its whole limit (500 for 11-02, unit price 0.119) and sup-a covers the rest (12300 x 0.125), cost 1597.00 EUR. These values are asserted by the tests of `test/requirements.plt` (groups `needs` and `suppliers`).

## 5. AI03 - Artificial neural networks study

The [study](../artifical-neural-networks/report.md) analyses three applications of artificial neural networks to LaPrizza's management:

| Application | Problem | Inputs | Output |
| --- | --- | --- | --- |
| A - Demand forecasting | Regression (multilayer perceptron) | Past daily quantities per product and size from confirmed orders, calendar features (weekday, holidays), product active/inactive status | Forecast entries (date, product, size, non-negative integer quantity) that the Prolog Requirements Planning uses, after the same validation as a manual forecast |
| B - Stock-shortage risk | Binary classification | Current stock in abstract units, forecast demand (A), size-dependent consumption, supplier lead time | Shortage probability per product and period, compared with a threshold; an early warning on top of the exact calculation |
| C - Preparation and waiting time | Regression | Order items and their state timings, pizza size and configuration, oven and resource usage | Estimated duration per activity or time until an order is ready |

The study also covers data quality (no real sales history yet, abstract units, catalogue changes, no customer data), evaluation (MAE/RMSE for regression, precision/recall/F1 for classification, comparison with a simple baseline, business criteria) and the risks of unsuitable predictions (black-box predictions, invalid outputs, false alarms). The conclusion is that **A is the most promising**, but only once real data exist, and always as an advisory tool reviewed by the Manager. No model was trained or deployed, as allowed by AI03. No identifiable customer data were used in examples or given to AI tools.

## 6. AI05 - Service endpoints

### 6.1 Endpoints

The SPA never calls Prolog directly. It calls the back end, which authorizes the user, builds the snapshot and calls the Prolog service with its own service identity (push).

| Layer | Endpoint | Caller and credential | Purpose |
| --- | --- | --- | --- |
| Back end | `POST /api/v2/planning/bom` | SPA, Manager token (`planning:execute`) | Bill of Materials of an AI scenario |
| Back end | `POST /api/v2/planning/requirements` | SPA, Manager token | Requirements planning of a forecast with a supplier scenario |
| Back end | `GET /api/v2/planning/runs[/{id}]` | SPA, Manager token | Saved results with their input versions |
| Back end | `GET /api/v2/ai-data/snapshot` | Manager token, or the Prolog pull path | Planning snapshot (AI06) |
| Prolog | `POST /service/bom`, `POST /service/requirements` | Back end, `X-Api-Key` (service identity) | Calculation with the snapshot sent in the body (push) |
| Prolog | `POST /bom`, `POST /requirements` | Client with a Manager token, forwarded to the back end | Direct calls for tests and demos (pull) |
| Prolog | `GET /health` | None | Liveness; does not call the back end |

The back-end routes are documented in OpenAPI (`/api/v2/docs`). `/api/v1` is a deprecated alias of the same router (ADR-0015). The Prolog routes, with all requests, responses and errors, are documented in [AI Service Interface](../flows/ai-service-access/service-interface.md).

### 6.2 Requests and results

- The request is `{ scenarioId, stockMode }`, plus `forecastId` and `supplierScenarioId` for the requirements. `scenarioId` is the code of an AI scenario (`^[A-Z0-9-]{1,64}$`); `stockMode` is `live` or `scenario`. The other ids are the MongoDB ids of the back end.
- The BOM result has `orders`, `items`, `shortages`, `production` and `warnings`. The requirements result has `plan`, `summary`, `requirements` (daily `needs`), `production` and `purchases` (chosen supplier, unit price, cost, arrival date, `onTime`, `capacityStated`, `unmet`).
- Every result carries `simulation: true`, `calculatedAt`, `scenario` and `inputs { snapshotId, sources }`, so each quantity can be traced to the exact data it came from. The back end adds the `runId` of the saved run.

### 6.3 Examples

**Valid request.**

```http
POST /api/v2/planning/bom
Authorization: Bearer <Manager token>
Content-Type: application/json

{ "scenarioId": "DEMO-PARTIAL", "stockMode": "scenario" }
```

```json
200 OK
{ "runId": "...", "status": "ok", "simulation": true, "feasible": false,
  "scenario": { "id": "DEMO-PARTIAL", "version": 1, "stockMode": "scenario", "name": "..." },
  "inputs": { "snapshotId": "...", "sources": { ... } },
  "shortages": [ { "productId": "c-mozzarella", "kind": "simple", "replenishmentNeeded": 2, "name": "..." } ],
  "production": [ { "productId": "c-massa", "toProduce": 2, "canProduce": true, "missingIngredients": [] } ],
  "items": [ ... ], "orders": [ ... ], "warnings": [] }
```

**Invalid input.**

```json
400 Bad Request
{ "error": { "status": 400, "code": "VALIDATION_ERROR", "message": "Validation failed.",
  "details": [ { "field": "stockMode", "type": "any.only", "message": "\"stockMode\" must be one of [live, scenario]" } ] } }
```

Unknown ids answer `404 AI_SCENARIO_NOT_FOUND`, `FORECAST_NOT_FOUND` or `SUPPLIER_SCENARIO_NOT_FOUND`; `stockMode: "scenario"` on a scenario without stock answers `400 SCENARIO_WITHOUT_STOCK`.

**Missing data.**

```json
422 Unprocessable Entity
{ "error": { "status": 422, "code": "AI_INVALID_DATA",
  "message": "The data needed for the calculation is invalid or incomplete.",
  "details": { "scenario": { ... }, "inputs": { ... },
    "problems": [ { "code": "MISSING_SCENARIO_STOCK", "productId": "c-mozzarella", "required": 6 } ] } } }
```

**Service unavailable.**

```http
503 Service Unavailable
Retry-After: 5

{ "error": { "status": 503, "code": "AI_SERVICE_UNAVAILABLE", "message": "The AI service is not available.",
  "details": { "reason": "connection_failed" } } }
```

No answer within the timeout gives `504 AI_SERVICE_TIMEOUT`. On the Prolog pull path, a back end that is down or too slow gives `503 AI_DATA_UNAVAILABLE` / `504 AI_DATA_TIMEOUT`.

### 6.4 Validation and outcomes

| Outcome | Answer | Shown by the SPA |
| --- | --- | --- |
| Successful calculation | `200`, `status: "ok"` (shortages give `feasible: false`, which is still a success) | Result tables and warnings |
| Invalid input | `400 VALIDATION_ERROR` / `SCENARIO_WITHOUT_STOCK`, `404 AI_SCENARIO_NOT_FOUND` / `FORECAST_NOT_FOUND` | Error next to the field |
| Missing information | `422 AI_INVALID_DATA` with `details.problems` | List of problems with the product or pizza ids |
| Service unavailable | `503 AI_SERVICE_UNAVAILABLE` (`details.reason`, `Retry-After: 5`), `504 AI_SERVICE_TIMEOUT` | "Service unavailable", with a retry hint |

The same rules are checked in the SPA (`validatePlanningInput`), in the back end (Joi) and in Prolog (`validate_input/3` plus the validation of the whole snapshot). The SPA blocks a second submission while a calculation is running (ADR-0049).

### 6.5 Access control

- Back end: `requirePermission(planning:execute)`, granted only to MANAGER. Without a token the answer is `401`; an Employee, Customer or Administrator gets `403`.
- Prolog, push path: the key must be equal to `AI_SERVICE_KEY` (at least 32 characters). Without a configured key the routes are closed, and a user token is not accepted as a service identity (`401 SERVICE_UNAUTHORIZED`).
- Prolog, pull path: without a token `401 TOKEN_MISSING`; otherwise the token is forwarded to the back end, which applies the same permission. The token is never logged nor returned.
- The Prolog service listens only on `127.0.0.1`.

### 6.6 Demonstration in the common solution

With the back end, the Prolog service and the AI01 demo seed running:

1. Log in as Manager and open `/ai` -> Execution.
2. Choose "Bill of Materials", scenario `DEMO-PARTIAL` and "Scenario stock", then execute. The result shows the mozzarella shortage and the dough to produce.
3. Choose "Requirements" with a forecast and a supplier scenario, then execute. The result shows the reference date, the daily needs and the purchases by supplier.
4. Stop the Prolog service and execute again. The page reports that the service is unavailable.

The same cases are automated in `bom-demo-test-flow.http` (pull path) and `planning-test-flow.http` (push path).

## 7. AI06 - Back-end data sources and knowledge base

### 7.1 Back-end data source

- Prolog gets all business data from one JSON document, the _planning snapshot_, built only by the back end at `GET /ai-data/snapshot?scenarioId&stockMode[&forecastId&supplierScenarioId]` (Manager only, `planning:execute`). It has no direct database access, no separate authoritative copy and no customer data (ADR-0020).
- The snapshot contains products, sizes, pizzas and their sizes, the BOM per pizza and size, aggregates (production/purchase), stock (live or scenario), the simulated orders, the forecast and the supplier offers (price EUR, stock units, lead time, optional limit). Its format is in [Snapshot format](../flows/ai-knowledge-base/snapshot-format.md).
- `meta` records `snapshotId`, `retrievedAt`, `simulated` and the origin and version of each input (`sources`).
- Missing or invalid values found by the back end are reported in `issues[]`, never defaulted.
- The snapshot reaches Prolog by **push** (the back end sends it to `/service/*` with `X-Api-Key`; used by the SPA) or **pull** (Prolog fetches it from `{AI_BACKEND_URL}/ai-data/snapshot` with the Manager's token; `AI_BACKEND_URL` defaults to `http://127.0.0.1:3000/api/v1`).

### 7.2 Construction of the knowledge base (`kb.pl`)

| Fact | Origin in the snapshot |
| --- | --- |
| `kb_meta/3`, `kb_source/2`, `kb_scenario/5` | `meta`, `meta.sources`, `scenario` |
| `product/4`, `size/2`, `pizza/1`, `pizza_size/2` | `products`, `sizes`, `pizzas` |
| `bom_item/4` | `bom` |
| `aggregate/2`, `aggregate_item/3` | `aggregates` |
| `stock/2` | `stock` |
| `order/2`, `ordered_item/4` | `orders` |
| `forecast/5`, `forecast_item/5` | `forecast` |
| `supplier_scenario/3`, `supplier/2`, `supplier_offer/5`, `supplier_limit/3` | `supplierScenario` (product, price EUR, stock units and lead time preserved; `supplier_limit` only when stated) |
| `kb_issue/2` | `issues` |

The whole snapshot is validated before anything is loaded. Problems such as `INVALID_QUANTITY`, `DUPLICATE_ENTRY`, `UNKNOWN_ITEM`, `INCOMPLETE_AGGREGATE`, `NESTED_AGGREGATE`, `PIZZA_AS_COMPONENT` or `PURCHASED_WITH_COMPOSITION` are all returned together, and nothing is loaded.

### 7.3 Refresh policy

- **One snapshot per calculation.** `with_snapshot/2` loads it under a mutex and in a transaction, runs the calculation and always clears the knowledge base, even when the calculation fails (ADR-0021).
- Two calculations never see each other's data, and old and new versions are never mixed: if the back end is unavailable the calculation fails (`503`/`504`) instead of using older facts.
- Scenario snapshots are never cached.
- Any simulated input makes the result `simulation: true`.

### 7.4 Examples

| Case | Result |
| --- | --- |
| Valid request (Manager, existing scenario) | `200` + snapshot |
| Invalid query (e.g. `stockMode` without `scenarioId`) | `400 BAD_REQUEST`, nothing read |
| No token / Employee | `401` / `403` |
| Unknown scenario / scenario without stock | `404 AI_SCENARIO_NOT_FOUND` / `400 SCENARIO_WITHOUT_STOCK` |
| Invalid data in the snapshot | `422 AI_INVALID_DATA`, knowledge base not loaded |
| Back end down / no answer (pull) | `503 AI_DATA_UNAVAILABLE` / `504 AI_DATA_TIMEOUT` |

## 8. Prolog execution examples

Run from `ai-scheduling/` with SWI-Prolog 9.

```sh
# BOM of a demonstration fixture, printed as JSON (no server, no back end)
swipl -g "bom_print_file('fixtures/demo-partial.json'), halt" bom.pl

# Invalid snapshot: the problems are listed and no quantity is calculated
swipl -g "bom_print_file('fixtures/invalid-multiple.json'), halt" bom.pl

# Requirements planning: the calculation evidence of section 4.6
swipl -q -g "(run_tests([needs, suppliers]) -> halt(0) ; halt(1))" test/requirements.plt

# HTTP service (reads ai-scheduling/.env; AI_SERVICE_KEY needed for /service/*)
./start-server.sh
curl http://127.0.0.1:5000/health
curl -X POST http://127.0.0.1:5000/bom \
     -H "Authorization: Bearer <Manager token>" -H "Content-Type: application/json" \
     -d '{"scenarioId":"DEMO-PARTIAL","stockMode":"scenario"}'
```

From the Prolog top level, the same calculation with an explicit reference date:

```prolog
?- use_module(library(http/json)), use_module(kb), use_module(requirements).
?- open('snapshot.json', read, In), json_read_dict(In, D), close(In),
   with_snapshot(D, requirements_calculate(_{scenarioId:"SC-1", stockMode:"scenario"},
                                            R, [today('2026-10-29')])),
   print_requirements(R).
```

`requirements_print_file/1` takes the request from the scenario of the snapshot, so the file must include `scenario` and `pizzas` (the fixtures of `test/requirements.plt` add them to `sample-snapshot.json`).

## 9. Tests and evidence

| Suite | Tests | Covers |
| --- | --- | --- |
| `test/kb.plt` | 61 | Loading and validation of the snapshot, refresh |
| `test/kb_ai01.plt` | 55 | AI01 fixtures, invalid fixtures, `with_snapshot/2`, configuration, fetch from the back end |
| `test/bom.plt` | 33 | The four demo scenarios, BOM rules, validation, warnings |
| `test/requirements.plt` | 30 | Net needs, supplier selection, limits, late offers, validation |
| `test/service.plt` | 11 | Push routes and service key |
| `test/server.plt` | 31 | Pull routes, validation, errors (run on its own: `swipl -q -g "(run_tests -> halt(0) ; halt(1))" test/server.plt`; not in `run-tests.sh`) |
| Back end | - | `ai-data.service.test.js`, `api.ai-data.test.js`, `ai-service.client.test.js`, `planning.service.test.js`, `planning-errors.test.js`, `api.authorization-matrix.test.js` |
| Flows | - | `bom-demo-test-flow.http`, `planning-test-flow.http`, `ai-data-test-flow.http` (stock unchanged before and after) |

## 10. Limitations

- No ordering workflow: AI01 uses the simulated orders of the scenario (A3).
- No purchase-order record exists yet; purchase proposals are results only (section 1).
- Offers are costed pro rata (no whole-offer rounding or minimum order), and an offer without `supplyLimit` is taken as unbounded and flagged `capacityStated: false` (4.5).
- No currency conversion (EUR only).
- Incompatible units are not flagged: the back end exports one abstract stock unit for every product, so they cannot occur with the current data. If products get different units, a `INCOMPATIBLE_UNIT` check will be needed before comparing offers.
- The allocations have no `orderDate` field; every order is placed on `plan.referenceDate`.
- The Prolog pull path uses the deprecated `/api/v1` alias by default (`AI_BACKEND_URL`); the push path used by the SPA does not depend on it.
- The neural-network study is a study: no model is trained or deployed (AI03).

## 11. References

- SWI-Prolog Reference Manual: HTTP server (`library(http/thread_httpd)`), JSON (`library(http/json)`), unit tests (`library(plunit)`).
- LaPrizza Sprint 2 user stories AI01-AI06 (`04 sprint 2.pdf`).
- Project documentation: [AI Bill of Materials](../flows/ai-bill-of-materials/README.md), [AI Requirements Planning](../flows/ai-requirements-planning/README.md), [AI Planning](../flows/ai-planning/README.md), [Supplier JSON format](../flows/ai-planning/supplier-json-format.md), [AI Service Access](../flows/ai-service-access/README.md), [AI Service Interface](../flows/ai-service-access/service-interface.md), [AI Knowledge Base](../flows/ai-knowledge-base/README.md), [Snapshot format](../flows/ai-knowledge-base/snapshot-format.md).
- ADRs: 0014 (API versioning), 0033 (immutable forecasts and supplier scenarios), 0034 (planning runs), 0036 (synchronous execution with duplicate-submission guard), 0039 (planning snapshot), 0040 (knowledge base per calculation), 0052 (product aggregates and stock-first BOM expansion), 0053 (simulated BOM scenarios and resettable demo seed), 0055 (requirements planning with chronological net needs and the cheapest on-time supplier).
- Neural networks study: [report](../artifical-neural-networks/report.md) and its sources (section 8).

## 12. Use of AI-generated content

| Tool | Use | Validation |
| --- | --- | --- |
| Claude, Gemini | Structure and wording of the study and of this report; drafts of code and tests | Checked against the user stories and the code; Prolog behaviour verified by the plunit tests (`./run-tests.sh`) and the demonstration fixtures; calculation values recomputed by hand (sections 3.5 and 4.6) |
| LLM (optional) | Preparation of supplier JSON for WEB07 | Offers labelled simulated; imported only after validation and explicit confirmation |

The examples of this report and of the study use only catalogue, stock, forecast and supplier data; no customer-identifying data are used (AI03, AI06).
