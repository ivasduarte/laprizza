# AI02 UC1 / UC3 - Calculate Requirements Planning (with Scenario Stock)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | AI Scheduling Module, Back-end API, Database |
| Endpoints | AI Scheduling Module: `POST /requirements` with `{ scenarioId, stockMode }` (`stockMode` `live` or `scenario`). Back end: `GET /ai-data/snapshot?scenarioId&stockMode` |
| Allowed roles | MANAGER (permission `planning:execute`), with the `Authorization: Bearer` token forwarded by the AI Scheduling Module to the back end |
| Success response | 200 OK, `{ status: "ok", simulation: true, calculatedAt, scenario, inputs, plan, summary, requirements[], production[], purchases[], warnings[] }` |
| Error handling | 401 `TOKEN_MISSING`, 400 `VALIDATION_ERROR`, 401/403 of the back end (as received), 404 `AI_SCENARIO_NOT_FOUND`, 422 `AI_INVALID_DATA` (scenario without stock in scenario mode, invalid snapshot, no forecast, invalid forecast line or recipe, missing stock, invalid reference date), 503 `AI_DATA_UNAVAILABLE`, 504 `AI_DATA_TIMEOUT` |
| ADRs | [ADR-0058](../../adr/0058-requirements-planning-with-chronological-net-needs-and-on-time-cheapest-supplier.md), [ADR-0040](../../adr/0040-product-aggregates-and-stock-first-bom-expansion.md), [ADR-0020](../../adr/0020-planning-snapshot-as-the-data-contract-with-the-ai-service.md), [ADR-0021](../../adr/0021-knowledge-base-loaded-per-calculation.md) |

## Description

The Manager asks the AI Scheduling Module for the requirements planning of the active forecast with the active supplier scenario. The diagram shows the direct call to the Prolog service (pull path), used by tests and demonstrations. From the Web Application the same calculation runs through the back end with a chosen forecast version and supplier scenario, and is recorded as a planning run (`POST /planning/requirements`, push path, [WEB07 UC9](../ai-planning/execute-forecast.md)); the snapshot, the knowledge base and `requirements.pl` are the same in both paths.

**UC1, the calculation.**

1. The AI Scheduling Module requires `Authorization: Bearer` (401 `TOKEN_MISSING`, the back end is not called) and validates the body: `scenarioId` `^[A-Z0-9-]{1,64}$` and `stockMode` `live` or `scenario` (400 `VALIDATION_ERROR` with `details[{ field, type, message }]`).
2. It asks the back end for the planning snapshot of the scenario, with the same token ([AI06 UC1](../ai-knowledge-base/provide-planning-snapshot.md)). The back end checks `planning:execute` (an Employee or Customer gets 403), loads the active AI scenario by code (404 `AI_SCENARIO_NOT_FOUND`), and builds the snapshot from the catalogue, the pizza BOM per size, the aggregates, the stock chosen by `stockMode`, the most recently created active forecast and the most recently created active supplier scenario. The scenario snapshot is never cached.
3. The snapshot is validated and loaded as facts for this calculation only ([AI06 UC2](../ai-knowledge-base/build-knowledge-base.md)). Any problem of the snapshot (for example an offer without a price or a lead time, a forecast line of an unknown product) answers 422 `AI_INVALID_DATA` with every problem.
4. `requirements_calculate/2` validates the request, the forecast and the reference date (no forecast is `MISSING_FORECAST`), then calculates: gross demand per day through the BOM; produced aggregates use their stock first and only what is produced is expanded into ingredients; the net need of each stock-controlled product per day, with the stock consumed in date order. The rules and a worked example are in the [README](./README.md#calculation-rules).
5. The supplier selection of every product with needs is [UC2](./select-suppliers.md): the cheapest offer that arrives on time, then the earliest late delivery for what is left, with the unmet quantities and their reason.
6. The answer reports the plan (forecast version, period and reference date), the summary (total cost, products to buy, feasible), the daily needs per product, the production schedule, the purchases by supplier with order date (`plan.referenceDate`), arrival date and cost, the warnings, and the scenario and inputs used. A plan with late or unmet needs is a result, not an error (`feasible: false`). The facts are cleared after the calculation.

**UC3, simulate with scenario stock (extends UC1).** With `stockMode: "scenario"` the back end puts the stock stored in the scenario in the snapshot instead of the real stock, so the same scenario always gives the same plan. A scenario without its own stock answers 400 `SCENARIO_WITHOUT_STOCK` in the back end, which the AI Scheduling Module returns as 422 `AI_INVALID_DATA` (`details.problems[0].code`). With `stockMode: "live"` the real stock of every active stock-controlled product is used, 0 when it has no record.

Nothing is written: the real stock and the stock of the scenario are read only, and the calculation creates no purchase order. In the pull path no planning run is saved (the push path of WEB07 UC9 saves one).

## Diagram

```mermaid
---
title: "AI02 UC1 / UC3 - Calculate Requirements Planning - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager (authorized client)<br/>[Person]
    participant ai as AI Scheduling Module<br/>[Container: SWI-Prolog]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: ai-data.routes.js]
        participant controller as AiDataController<br/>[Component: Controller]
        participant service as AiDataService<br/>[Component: Service]
        participant repo as AiDataRepository<br/>[Component: Repository]
    end
    participant db as Database<br/>[Container: MongoDB]

    activate manager
    manager->>ai: POST /requirements { scenarioId, stockMode }, Bearer token
    activate ai
    ai->>ai: Check the token and validate the body
    alt No token or invalid body
      ai-->>manager: 401 TOKEN_MISSING / 400 VALIDATION_ERROR
    else Valid
      ai->>route: GET /ai-data/snapshot?scenarioId&stockMode, same Bearer token
      activate route
      route->>route: requirePermission(Permission.PLANNING_EXECUTE), Joi snapshotQuerySchema
      alt 401, 403 or invalid query
        route-->>ai: 401 / 403 / 400 BAD_REQUEST (nothing is read)
      else Accepted
        route->>controller: getSnapshot(query)
        activate controller
        controller->>service: getSnapshot(aiDataRepository, undefined, { scenarioId, stockMode })
        activate service
        service->>repo: findActiveScenarioByCode(scenarioId)
        activate repo
        repo->>db: Find the active AI scenario
        db-->>repo: Scenario or nothing
        repo-->>service: Scenario or null
        alt Unknown scenario
          service-->>controller: AppError 404 AI_SCENARIO_NOT_FOUND
        else stockMode scenario and the scenario has no stock (UC3)
          service-->>controller: AppError 400 SCENARIO_WITHOUT_STOCK
        else Scenario found
          par Read the planning data
            service->>repo: listProducts() (with aggregate), listSizes(), listPredefinedPizzas()
          and
            service->>repo: listStock() (live mode only)
          and
            service->>repo: getActiveForecast(), getActiveSupplierScenario()
          end
          repo->>db: Find the active documents (no customer data)
          db-->>repo: Documents
          repo-->>service: Products, sizes, pizzas, real stock, forecast, supplier scenario
          service->>service: buildScenarioSnapshot(data, stockMode, now)
          Note over service: bom, aggregates, pizzas, stock (scenario: as stored, live: real stock with 0 without a record), forecast (entries per date, product, size), supplierScenario (offers: priceEur, stockUnits, leadTimeDays, supplyLimit?), issues, meta (snapshotId, retrievedAt, sources)
          service-->>controller: Snapshot
        end
        deactivate repo
        deactivate service
        controller-->>route: 200 OK (snapshot) or error
        deactivate controller
        route-->>ai: 200 OK or error
      end
      deactivate route

      alt Back end answered with an error, or did not answer
        ai-->>manager: 401/403 (as received), 404 AI_SCENARIO_NOT_FOUND, 422 AI_INVALID_DATA (SCENARIO_WITHOUT_STOCK), 503 AI_DATA_UNAVAILABLE or 504 AI_DATA_TIMEOUT
      else Snapshot received
        ai->>ai: Validate the snapshot and load it as facts (one calculation only)
        ai->>ai: requirements_calculate: validate the request, forecast and reference date
        ai->>ai: Gross demand per day (BOM), produced aggregates (stock first), net needs per day
        ai->>ai: Purchase plan of every product with needs (UC2, see select-suppliers.md)
        ai->>ai: Clear the facts
        alt Missing forecast, invalid forecast line or recipe, missing stock, invalid snapshot
          ai-->>manager: 422 AI_INVALID_DATA { scenario, inputs, problems } (no quantities)
        else Calculated
          ai-->>manager: 200 OK { status: "ok", simulation: true, plan, summary, requirements, production, purchases, warnings }
        end
      end
    end
    deactivate ai
    deactivate manager

    Note over ai,db: Read only: the real stock and the scenario stock are never changed, and no purchase order is created.
```

See the [README](./README.md) for the notation key, the calculation and supplier selection rules, the result format and the element catalogue.
