# UC4 - Delete (Deactivate) Forecast

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `PUT /forecasts/{id}` with body `{ "isActive": false }` |
| Allowed roles | MANAGER (permission `forecasts:write`) |
| Success response | 200 OK, forecast DTO with `isActive: false` |
| Error handling | 400 `BAD_REQUEST` (invalid id format, or a body other than `{ "isActive": false }`: "Only deactivation is supported: isActive must be false"), 404 `NOT_FOUND` "Forecast not found." (unknown or already inactive), 401/403 |
| ADRs | [ADR-0033](../../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md) |

## Description

Deleting a forecast is a soft delete. The Manager presses "Deactivate" on a version and the page asks for confirmation in a dialog: "Deactivate “name” vN? It is no longer listed nor used in new calculations. Saved results are kept." Cancelling sends nothing.

On confirmation the page sends `PUT /forecasts/{id}` with `{ "isActive": false }`. The route checks the permission, the id format and the body: the Joi schema accepts only `isActive: false`. `updateForecast` checks the value again, loads the forecast (404 if it does not exist or is already inactive) and sets `isActive: false`.

The document stays in the database. It is no longer listed, `GET /forecasts/{id}` answers 404, and an execution that asks for it answers 404 `FORECAST_NOT_FOUND`. Saved planning runs keep its `{ id, name, version }`, so their results are still consulted in [UC10](./consult-planning-results.md). Because `getLatestVersion` counts inactive versions, the version number is never given to a new forecast.

On success the page shows "“name” vN was deactivated.", refreshes the list and closes the detail if it showed that version. A 404 also refreshes the list, since it means that the version was already deactivated elsewhere. Other errors are shown above the list.

## Diagram

```mermaid
---
title: "UC4 - Delete (Deactivate) Forecast - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant panel as ForecastsPanel<br/>[Component: React, TanStack Query]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as ForecastController<br/>[Component: Controller]
        participant service as ForecastService<br/>[Component: Service]
        participant repo as ForecastRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>panel: Presses "Deactivate" on "name" vN
    activate panel
    panel-->>manager: Confirmation dialog (saved results are kept)

    alt Manager cancels
      panel-->>manager: Nothing is sent
    else Manager confirms
      panel->>route: PUT /forecasts/{id} { "isActive": false }
      activate route
      route->>route: requirePermission(Permission.FORECASTS_WRITE)
      route->>route: validateId and Joi deactivateSchema (isActive must be false)
      alt Invalid id or body
        route-->>panel: 400 BAD_REQUEST
      else Accepted
        route->>controller: update(req, res, next, forecastRepository)
        activate controller
        controller->>service: updateForecast(id, { isActive: false }, forecastRepository)
        activate service
        service->>repo: findById(id)
        activate repo
        repo-->>service: Active forecast or null
        alt Missing or already inactive
          service-->>controller: AppError(404, "Forecast not found.")
        else Active
          service->>repo: update(id, { isActive: false })
          repo-->>service: Deactivated document (kept in the database)
          service->>service: toForecastDto(forecast)
          service-->>controller: Forecast DTO (isActive false)
        end
        deactivate repo
        deactivate service
        controller-->>panel: 200 OK or 404
        deactivate controller
      end
      deactivate route

      alt 200 OK or 404
        panel-->>manager: Toast "“name” vN was deactivated." (200), close its detail, refresh the list
      else Other error
        panel-->>manager: Show the error above the list
      end
    end
    deactivate panel
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
