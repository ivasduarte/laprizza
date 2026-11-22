# UC2 - List and Consult Forecasts

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `GET /forecasts[?name=]` (list, optional search by name), `GET /forecasts/{id}` (one version) |
| Allowed roles | MANAGER (permission `forecasts:read`) |
| Success response | 200 OK, array of forecast DTOs (active versions only) or one forecast DTO |
| Error handling | 400 `BAD_REQUEST` (invalid query or id format), 404 `NOT_FOUND` "Forecast not found." (unknown or inactive id), 401/403 (no valid token or no permission) |
| ADRs | [ADR-0046](../../adr/0046-immutable-versioned-forecasts-and-supplier-scenarios.md) |

## Description

When the Forecasts tab opens, `ForecastsPanel` loads the forecasts (`GET /forecasts`) and the catalogue it needs to show names (sellable products, predefined pizzas and sizes). The back end returns only active versions: `forecastRepository.list()` filters `isActive != false` and sorts by name and version, and `listForecasts` filters again before mapping each one with `toForecastDto`. With `?name=` the repository searches by name (case-insensitive regular expression, escaped).

`groupForecasts` groups the versions by name, ignoring case like the back-end versioning, with the newest version first and the tag "Latest" when there is more than one. Each row shows the version, the period, the number of entries and days, and the actions View, New version and Deactivate.

"View" opens `ForecastDetail` with the DTO already in the list. No extra request is made. The detail shows the period, the days with consumption, the total quantity, the id, the note "Omitted entries mean zero consumption" and the entries sorted by date and product name, plus the buttons "Run with this forecast" ([UC9](./execute-forecast.md)) and "New version" ([UC3](./edit-forecast.md)).

`GET /forecasts/{id}` returns one version and is available through the API. It answers 400 when the id is not 24 hex characters and 404 when the forecast does not exist or is inactive (`getForecastById`).

## Diagram

```mermaid
---
title: "UC2 - List and Consult Forecasts - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant panel as ForecastsPanel<br/>[Component: React, TanStack Query]
        participant model as forecast-model<br/>[Component: JavaScript module]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as ForecastController<br/>[Component: Controller]
        participant service as ForecastService<br/>[Component: Service]
        participant repo as ForecastRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager

    alt List the forecasts (page)
      manager->>panel: Opens the Forecasts tab
      activate panel
      panel->>route: GET /forecasts
      activate route
      route->>route: requirePermission(Permission.FORECASTS_READ)
      route->>route: Validate the query (Joi: optional name)
      route->>controller: list(req, res, next, forecastRepository)
      activate controller
      controller->>service: listForecasts(query, forecastRepository)
      activate service
      alt name in the query
        service->>repo: search(name)
      else no name
        service->>repo: list()
      end
      activate repo
      repo-->>service: Active forecasts, sorted by name and version
      deactivate repo
      service->>service: Keep the active ones, toForecastDto(each)
      service-->>controller: Array of forecast DTOs
      deactivate service
      controller-->>panel: 200 OK
      deactivate controller
      deactivate route
      panel->>model: groupForecasts(forecasts)
      activate model
      model-->>panel: Groups by name, newest version first
      deactivate model
      panel-->>manager: Table of versions ("Latest" tag, period, entries)
      manager->>panel: Presses "View"
      panel-->>manager: ForecastDetail from the list data (no request)
      deactivate panel
    else Consult one version (API)
      manager->>route: GET /forecasts/{id}
      activate route
      route->>route: requirePermission(Permission.FORECASTS_READ)
      route->>route: validateId (24 hex)
      alt Invalid id
        route-->>manager: 400 BAD_REQUEST "Invalid ID format"
      else Valid id
        route->>controller: getById(req, res, next, forecastRepository)
        activate controller
        controller->>service: getForecastById(id, forecastRepository)
        activate service
        service->>repo: findById(id)
        activate repo
        repo-->>service: Active forecast or null
        deactivate repo
        alt Missing or inactive
          service-->>controller: AppError(404, "Forecast not found.")
        else Found
          service->>service: toForecastDto(forecast)
          service-->>controller: Forecast DTO
        end
        deactivate service
        controller-->>manager: 200 OK or 404
        deactivate controller
      end
      deactivate route
    end
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
