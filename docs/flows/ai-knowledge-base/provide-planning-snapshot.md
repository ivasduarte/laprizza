# AI06 UC1 - Provide Planning Snapshot

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | AI Scheduling Module, Back-end API, Database |
| Endpoint | `GET /ai-data/snapshot?scenarioId&stockMode[&forecastId&supplierScenarioId]` (back end); called by `fetch_snapshot/3` of the Prolog service (pull) or by `PlanningService` in the back end (push) |
| Allowed roles | MANAGER (permission `planning:execute`) |
| Success response | 200 OK, planning snapshot ([format](./snapshot-format.md)) |
| Error handling | Back end: 401 (no valid token), 403 (no permission), 400 `BAD_REQUEST` (invalid query; nothing is read), 404 `AI_SCENARIO_NOT_FOUND`, 400 `SCENARIO_WITHOUT_STOCK`, 404 `FORECAST_NOT_FOUND` / `SUPPLIER_SCENARIO_NOT_FOUND`. As seen by a client of the Prolog service (pull): 401/403 of the back end as received, 404 `AI_SCENARIO_NOT_FOUND`, 422 `AI_INVALID_DATA` (other 400 of the back end), 503 `AI_DATA_UNAVAILABLE`, 504 `AI_DATA_TIMEOUT`. |
| ADRs | [ADR-0020](../../adr/0020-planning-snapshot-as-the-data-contract-with-the-ai-service.md), [ADR-0004](../../adr/0004-contract-first-rest-api.md), [ADR-0018](../../adr/0018-secrets-management-strategy.md) |

## Description

The snapshot is built only by the back end and is the only way business data reaches the Prolog service. The diagram shows the pull path: a client with a Manager token calls `POST /requirements` (or `POST /bom`) on the Prolog service, which asks the back end for the snapshot with the same token. In the push path, used by the Web Application, `PlanningService` calls the same `getSnapshot` inside the back end and sends the result to `POST /service/requirements` ([UC3](./refresh-per-calculation.md), [WEB07 UC9](../ai-planning/execute-forecast.md)).

The Prolog service:

1. Checks the `Authorization: Bearer` header (401 `TOKEN_MISSING`) and the body `{ scenarioId, stockMode }` (`validate_input/3`, 400 `VALIDATION_ERROR` with the back-end detail format).
2. Calls `fetch_with_deadline/3`, which runs `fetch_snapshot/3` in its own thread and waits at most `AI_BACKEND_TIMEOUT_SECONDS` + 0.5 s (10.5 s by default), because the connection timeout of `http_open` cannot be interrupted on every platform. A late answer is discarded.
3. `fetch_snapshot/3` sends `GET {AI_BACKEND_URL}/ai-data/snapshot?scenarioId=..&stockMode=..` with `Authorization: Bearer <token>` and `Accept: application/json`. Only these two parameters are sent, so the active forecast and supplier scenario are used. The token is never logged and never part of an error term.

The back end:

1. `requirePermission(Permission.PLANNING_EXECUTE)` authenticates the token and checks the permission (Manager only).
2. Validates the query with `snapshotQuerySchema` (`scenarioId` `^[A-Z0-9-]{1,64}$` and `stockMode` `live` or `scenario`, both or neither; `forecastId` and `supplierScenarioId` 24 hex; other keys allowed). An invalid query answers 400 `BAD_REQUEST` and reads nothing.
3. `AiDataController.getSnapshot` passes only the keys that were sent to `getSnapshot(aiDataRepository, undefined, params)`. With `scenarioId`, `getScenarioSnapshot` loads the active AI scenario by code (`findActiveScenarioByCode`, 404 `AI_SCENARIO_NOT_FOUND`) and rejects `stockMode: "scenario"` when the scenario has no stock (400 `SCENARIO_WITHOUT_STOCK`).
4. Reads in parallel the active products, sizes and predefined pizzas, the real stock (only in `live` mode), the forecast and the supplier scenario: by id when given (404 when unknown or inactive), otherwise the most recently created active ones.
5. `buildScenarioSnapshot` builds the BOM (`buildBom`, reporting problems in `issues`), the aggregates (`buildAggregates`), the pizzas and their sizes (`buildPizzas`), the stock (`buildLiveStock` or `buildScenarioStock`), the orders of the scenario, the forecast and the supplier scenario, and `meta` with the `snapshotId` (hash of the content), one `retrievedAt` and the source and version of every input. This path is never cached.

Back in the Prolog service, a 200 is parsed as JSON (otherwise 503 `invalid_backend_response`). 401 and 403 of the back end are returned to the client as received; 404 `AI_SCENARIO_NOT_FOUND` becomes 404 `AI_SCENARIO_NOT_FOUND`; another 400 becomes 422 `AI_INVALID_DATA`; 5xx, other answers and connection failures become 503 `AI_DATA_UNAVAILABLE`; no answer in time becomes 504 `AI_DATA_TIMEOUT`. With a snapshot, the knowledge base is built for the calculation ([UC2](./build-knowledge-base.md)).

## Diagram

```mermaid
---
title: "UC1 - Provide Planning Snapshot (pull) - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor client as Manager (direct call)<br/>[Person]
    box rgba(170,130,190,0.15) AI Scheduling Module [Container: SWI-Prolog]
        participant server as AI HTTP Server<br/>[Component: server.pl]
        participant kb as Knowledge Base<br/>[Component: kb.pl]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as AiDataController<br/>[Component: Controller]
        participant service as AiDataService<br/>[Component: Service]
        participant repo as AiDataRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate client
    client->>server: POST /requirements { scenarioId, stockMode }, Bearer token
    activate server
    server->>server: bearer_token/2 and validate_input/3
    alt No token or invalid body
      server-->>client: 401 TOKEN_MISSING or 400 VALIDATION_ERROR
    else Valid
      server->>kb: fetch_with_deadline(Params, Token) (thread, AI_BACKEND_TIMEOUT_SECONDS + 0.5 s)
      activate kb
      kb->>route: GET /ai-data/snapshot?scenarioId&stockMode, Bearer token (fetch_snapshot/3)
      activate route
      route->>route: requirePermission(Permission.PLANNING_EXECUTE)
      route->>route: Validate the query (Joi snapshotQuerySchema)
      alt 401, 403 or invalid query
        route-->>kb: 401 / 403 / 400 BAD_REQUEST (nothing is read)
      else Accepted
        route->>controller: getSnapshot(req, res, next, aiDataRepository, query)
        activate controller
        controller->>service: getSnapshot(aiDataRepository, undefined, params)
        activate service
        service->>repo: findActiveScenarioByCode(scenarioId)
        activate repo
        repo-->>service: AI scenario or null
        alt Unknown scenario, or no scenario stock in scenario mode
          service-->>controller: AppError 404 AI_SCENARIO_NOT_FOUND / 400 SCENARIO_WITHOUT_STOCK
        else Scenario found
          par Read the planning data (Promise.all)
            service->>repo: listProducts(), listSizes(), listPredefinedPizzas()
          and
            service->>repo: listStock() (live mode only)
          and
            service->>repo: getActiveForecast() / getActiveSupplierScenario()
          end
          repo-->>service: Active documents (no customer data)
          service->>service: buildScenarioSnapshot(data, stockMode, now)
          Note over service: bom, aggregates, pizzas, stock, orders, forecast, supplierScenario, issues, meta (snapshotId, retrievedAt, sources)
          service-->>controller: Snapshot
        end
        deactivate repo
        deactivate service
        controller-->>kb: 200 OK (snapshot) or error
        deactivate controller
      end
      deactivate route

      alt No answer within the deadline
        kb-->>server: kb_error(backend_timeout)
        server-->>client: 504 AI_DATA_TIMEOUT
      else Connection failed, 5xx, invalid JSON or unexpected status
        kb-->>server: kb_error(backend_unavailable(Reason))
        server-->>client: 503 AI_DATA_UNAVAILABLE (details.reason)
      else 401 or 403
        kb-->>server: kb_error(backend_denied(Status, Body))
        server-->>client: Same status and body as the back end
      else 404 AI_SCENARIO_NOT_FOUND or other 400
        kb-->>server: kb_error(scenario_not_found(Id)) / kb_error(backend_rejected(Code, Body))
        server-->>client: 404 AI_SCENARIO_NOT_FOUND / 422 AI_INVALID_DATA
      else 200 OK
        kb-->>server: Snapshot (JSON dict)
        Note over server,kb: Build the knowledge base and calculate, see UC2
        server-->>client: 200 result or 422 AI_INVALID_DATA
      end
      deactivate kb
    end
    deactivate server
    deactivate client

    Note over client,repo: Push path (AI05): PlanningService calls the same getSnapshot inside the back end and sends the snapshot in the body of POST /service/requirements (see UC3)
```

See the [README](./README.md) for the notation key and the element catalogue.
