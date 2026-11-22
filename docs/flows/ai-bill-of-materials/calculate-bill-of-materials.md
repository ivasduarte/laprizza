# AI01 UC2 / UC3 - Calculate Bill of Materials (with Scenario Stock)

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | AI Scheduling Module, Back-end API, Database |
| Endpoints | AI Scheduling Module: `POST /bom` with `{ scenarioId, stockMode }` (`stockMode` `live` or `scenario`). Back end: `GET /ai-data/snapshot?scenarioId&stockMode` |
| Allowed roles | MANAGER (permission `planning:execute`), with the `Authorization: Bearer` token forwarded by the AI Scheduling Module to the back end |
| Success response | 200 OK, `{ status: "ok", simulation: true, feasible, calculatedAt, scenario, inputs, orders[], items[], shortages[], production[], warnings[] }` |
| Error handling | 401 `TOKEN_MISSING`, 400 `VALIDATION_ERROR`, 401/403 of the back end (as received), 404 `AI_SCENARIO_NOT_FOUND`, 422 `AI_INVALID_DATA` (scenario without stock in scenario mode, invalid snapshot, invalid order or recipe, missing stock), 503 `AI_DATA_UNAVAILABLE`, 504 `AI_DATA_TIMEOUT` |
| ADRs | [ADR-0052](../../adr/0052-product-aggregates-and-stock-first-bom-expansion.md), [ADR-0053](../../adr/0053-simulated-bom-scenarios-with-selectable-stock-and-a-resettable-demo-seed.md), [ADR-0039](../../adr/0039-planning-snapshot-as-the-data-contract-with-the-ai-service.md), [ADR-0040](../../adr/0040-knowledge-base-loaded-per-calculation.md) |

## Description

The Manager asks the AI Scheduling Module for the Bill of Materials of an AI scenario. The diagram shows the direct call to the Prolog service (pull path), used by the demonstration flow and by tests. From the Web Application the same calculation runs through the back end (`POST /planning/bom`, push path, [AI05 UC1](../ai-service-access/calculate-bom.md)); the snapshot, the knowledge base and `bom.pl` are the same in both paths.

**UC2, the calculation.**

1. The AI Scheduling Module requires `Authorization: Bearer` (401 `TOKEN_MISSING`, the back end is not called) and validates the body: `scenarioId` `^[A-Z0-9-]{1,64}$` and `stockMode` `live` or `scenario` (400 `VALIDATION_ERROR` with `details[{ field, type, message }]`).
2. It asks the back end for the planning snapshot of the scenario, with the same token ([AI06 UC1](../ai-knowledge-base/provide-planning-snapshot.md)). The back end checks `planning:execute` (an Employee or Customer gets 403), loads the active AI scenario by code (404 `AI_SCENARIO_NOT_FOUND`) and builds the snapshot from the current catalogue, the pizza BOM per size, the aggregates and the stock chosen by `stockMode`. The scenario snapshot is never cached.
3. The snapshot is validated and loaded as facts for this calculation only ([ADR-0040](../../adr/0040-knowledge-base-loaded-per-calculation.md)). Any problem of the snapshot answers 422 `AI_INVALID_DATA` with every problem.
4. `bom_calculate/2` validates the order lines (predefined pizza, allowed size, complete recipe), then calculates in two passes: each aggregate uses its stock first and only the missing part of a produced aggregate is expanded into its ingredients; every simple product is then counted once, with its direct and derived demand ([ADR-0052](../../adr/0052-product-aggregates-and-stock-first-bom-expansion.md)). The rules and a worked example are in the [README](./README.md#calculation-rules).
5. The answer reports, for each item, the quantity required, the stock available and used, the hypothetical remaining stock (never negative) and the shortage; the replenishment needs (`shortages`), the aggregates to produce (`production`), the warnings, and the scenario and inputs used. Shortages are a result, not an error (`feasible: false`). The facts are cleared after the calculation.

**UC3, simulate with scenario stock (extends UC2).** With `stockMode: "scenario"` the back end puts the stock stored in the scenario in the snapshot instead of the real stock, so the same scenario always gives the same result. A scenario without its own stock answers 400 `SCENARIO_WITHOUT_STOCK` in the back end, which the AI Scheduling Module returns as 422 `AI_INVALID_DATA` (`details.problems[0].code`). With `stockMode: "live"` the real stock of every active stock-controlled product is used, 0 when it has no record.

Nothing is written: the real stock and the stock of the scenario are read only, and the calculation creates no purchase order. In the pull path no planning run is saved (the push path of AI05 saves one).

## Diagram

```mermaid
---
title: "AI01 UC2 / UC3 - Calculate Bill of Materials - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager (authorized client)<br/>[Person]
    participant ai as AI Scheduling Module<br/>[Container: SWI-Prolog]
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: ai-data.routes.js]
        participant controller as AiDataController<br/>[Component: Controller]
        participant service as AiDataService<br/>[Component: Service]
        participant repo as AiDataRepository / AiScenarioRepository<br/>[Component: Repository]
    end
    participant db as Database<br/>[Container: MongoDB]

    activate manager
    manager->>ai: POST /bom { scenarioId, stockMode }, Bearer token
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
        db-->>repo: Scenario (orders, stock or null) or nothing
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
          end
          repo->>db: Find the active documents (no customer data)
          db-->>repo: Documents
          repo-->>service: Products, sizes, pizzas, real stock
          service->>service: buildScenarioSnapshot(data, stockMode, now)
          Note over service: bom, aggregates, pizzas, orders of the scenario, stock (scenario: as stored, live: real stock with 0 without a record), issues, meta (snapshotId, sources)
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
        ai->>ai: bom_calculate: validate the orders, pass 1 (aggregates, stock first), pass 2 (simple products once)
        ai->>ai: Clear the facts
        alt Invalid snapshot, order or recipe, or missing stock
          ai-->>manager: 422 AI_INVALID_DATA { scenario, inputs, problems } (no quantities)
        else Calculated
          ai-->>manager: 200 OK { status: "ok", simulation: true, feasible, items, shortages, production, warnings }
        end
      end
    end
    deactivate ai
    deactivate manager

    Note over ai,db: Read only: the real stock and the scenario stock are never changed, and no purchase order is created.
```

See the [README](./README.md) for the notation key, the calculation rules and the element catalogue, and [Demonstration Scenarios](./demonstration-scenarios.md) for the initial data and the expected results.
