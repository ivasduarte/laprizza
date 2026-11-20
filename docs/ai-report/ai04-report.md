# AI04 - IARTI Technical Report

## AI03 - Artificial Neural Networks Study

The study looked at how artificial neural networks could support LaPrizza's management. Three applications were analysed:

- **A - Demand forecasting** per product and size (regression). It would propose the daily forecasts that the Prolog Requirements Planning uses.
- **B - Stock-shortage risk** (classification). It would flag products likely to run short.
- **C - Preparation and waiting time** (regression). It would estimate durations for the scheduler.

The study also covered data quality (no real sales history yet, abstract units, catalogue changes, no customer data), evaluation (MAE/RMSE for regression, precision/recall/F1 for classification, comparison with a simple baseline) and risks (black-box predictions, invalid outputs, false alarms). The conclusion is that **A is the most promising**, but only once real data exist, and always as an advisory tool reviewed by the Manager. Generative AI (Claude, Gemini) was used for structure and wording, and its output was checked against the requirements and rewritten by the team.

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
