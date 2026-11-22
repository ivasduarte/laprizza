# UC10 - Consult Planning Results

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `GET /planning/runs[?kind&forecastId&supplierScenarioId]` (list), `GET /planning/runs/{id}` (one run) |
| Allowed roles | MANAGER (permission `planning:execute`) |
| Success response | 200 OK. List: up to 100 run summaries, newest first, `{ id, kind, createdAt, requestedBy, request, snapshotId, scenario, forecast, supplierScenario, bomVersion, stockSource, status, summary, feasible }` without `result`. Detail: the same fields plus the full `result`. |
| Error handling | 400 `VALIDATION_ERROR` (query: `kind` not `bom`/`requirements`, ids not 24 hex), 400 `BAD_REQUEST` "Invalid ID format" (run id), 404 `PLANNING_RUN_NOT_FOUND`, 401/403 |
| ADRs | [ADR-0047](../../adr/0047-recording-planning-runs-with-their-input-versions.md) |

## Description

Every successful execution ([UC9](./execute-forecast.md)) is saved as a planning run (`PlanningRun`, append-only, never updated). A run records:

- `kind` and `request` (`scenarioId`, `stockMode`, `forecastId`, `supplierScenarioId` as sent, `null` when not chosen);
- `snapshotId`, `scenario` (the AI scenario), `forecast` and `supplierScenario` as `{ id, name, version }`, `bomVersion` (hash of the catalogue and BOM) and `stockSource` (`{ source: "backend-live", retrievedAt }` or `{ source: "scenario", scenarioId, scenarioVersion, retrievedAt }`), all taken from the snapshot built by the back end, not from the AI answer;
- `status`, the full `result` and `requestedBy` (user id).

This is what links each result to the forecast version, the stock snapshot, the pizza BOM and the supplier scenario it used. Since a forecast or a supplier scenario is never changed (an edit creates a new version, a delete deactivates), an old result keeps its meaning after later edits.

The Results tab (`RunsPanel`) loads `GET /planning/runs?kind=requirements`, optionally with the `forecastId` chosen in the filter. The filter offers the active forecast versions; runs of deactivated versions are still listed under "All forecasts". `planningRunRepository.list(filters)` filters by `kind`, `forecast.id` and `supplierScenario.id`, reads only the summary fields (`result.summary` and `result.feasible`, not the full plan), sorts by `createdAt` descending and returns at most 100 runs. The table shows the date, the forecast version, the supplier scenario (or "No supplier scenario"), the snapshot id, the BOM version, the stock source ("Current stock" or "Stock of the scenario"), the total cost and the feasibility.

"View", or "Open in results" after an execution, opens `RunDetail`, which loads `GET /planning/runs/{id}` and shows the same associations and the full plan with the component used by the execution (`RequirementsResult`).

## Diagram

```mermaid
---
title: "UC10 - Consult Planning Results - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant runsPanel as RunsPanel<br/>[Component: React, TanStack Query]
        participant view as RequirementsResult<br/>[Component: React component]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as PlanningController<br/>[Component: Controller]
        participant service as PlanningService<br/>[Component: Service]
        participant repo as PlanningRunRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>runsPanel: Opens the Results tab (optional filter: forecast version)
    activate runsPanel
    runsPanel->>route: GET /planning/runs?kind=requirements[&forecastId=]
    activate route
    route->>route: requirePermission(Permission.PLANNING_EXECUTE)
    route->>route: validateRunsQuery (Joi: kind, forecastId, supplierScenarioId)
    alt Invalid query
      route-->>runsPanel: 400 VALIDATION_ERROR
    else Valid query
      route->>controller: listRuns(req, res, next, planningService, filters)
      activate controller
      controller->>service: listRuns(filters)
      activate service
      service->>repo: list({ kind, forecastId, supplierScenarioId })
      activate repo
      repo-->>service: Summary fields, newest first, at most 100
      deactivate repo
      service->>service: toPlanningRunSummaryDto(each)
      service-->>controller: Run summaries (no result)
      deactivate service
      controller-->>runsPanel: 200 OK
      deactivate controller
    end
    deactivate route
    runsPanel-->>manager: Table: date, forecast vN, supplier scenario, snapshot, BOM, stock source, cost, feasibility

    manager->>runsPanel: Presses "View" (or "Open in results" after an execution)
    runsPanel->>route: GET /planning/runs/{id}
    activate route
    route->>route: requirePermission(Permission.PLANNING_EXECUTE) and validateRunId
    alt Invalid id
      route-->>runsPanel: 400 BAD_REQUEST "Invalid ID format"
    else Valid id
      route->>controller: getRun(req, res, next, planningService)
      activate controller
      controller->>service: getRun(id)
      activate service
      service->>repo: findById(id)
      activate repo
      repo-->>service: Planning run or null
      deactivate repo
      alt Not found
        service-->>controller: AppError(404, PLANNING_RUN_NOT_FOUND)
      else Found
        service->>service: toPlanningRunDto(run)
        service-->>controller: Run with its full result
      end
      deactivate service
      controller-->>runsPanel: 200 OK or 404
      deactivate controller
    end
    deactivate route
    runsPanel->>view: RequirementsResult(run.result)
    activate view
    view-->>manager: Versions used and the full plan
    deactivate view
    deactivate runsPanel
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
