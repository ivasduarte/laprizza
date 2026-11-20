# UC1 - Create Forecast

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `POST /forecasts` |
| Allowed roles | MANAGER (permission `forecasts:write`) |
| Success response | 201 Created, forecast DTO `{ id, name, version, startDate, endDate, entries[], isActive }` with the version assigned by the back end (1 for a new name) |
| Error handling | 400 `BAD_REQUEST` (body rejected by Joi: missing field, date not `YYYY-MM-DD`, id not 24 hex, quantity not an integer ≥ 0), 400 `VALIDATION_ERROR` (business rules, every problem at once), 409 `CONFLICT` (the same version was saved by a concurrent request: try again), 401/403 (no valid token or no permission). Validation errors carry `details` `[{ field, type, message }]`. |
| ADRs | [ADR-0033](../../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md), [ADR-0005](../../adr/0005-contract-first-rest-api.md), [ADR-0018](../../adr/0018-internationalization-of-the-web-application-%28english-and-portuguese%29.md) |

## Description

In the Forecasts tab, the Manager presses "New forecast" and fills in the name, the start and end dates and the daily entries. Each entry has a date, a product, a size and a quantity. The product list offers only active, sellable products (`buildProductOptions`, fed by `GET /products?sellable=true&isActive=true`, `GET /predefined-pizzas` and `GET /pizza-size`). A predefined pizza offers only its own sizes, and the size is chosen automatically when there is only one. Other products have no size. "Duplicate" copies an entry to the next day and "Remove" deletes it. The form states that omitted entries mean zero consumption.

On Save, `validateForecast` checks the form with the same rules and codes as the back end (required fields, real dates, end not before start, at least one entry, dates inside the period, known product, size required or not applicable, integer quantity ≥ 0, no duplicate date/product/size). If there is a problem, the fields are marked, the first invalid one gets the focus and no request is sent. Otherwise `toPayload` builds the body, without `version`, and the form sends `POST /forecasts`.

The Back-end API:

1. **Authorization:** `requirePermission(Permission.FORECASTS_WRITE)` authenticates the token and checks the permission.
2. **Joi (`forecastSchema`, `abortEarly: false`, `stripUnknown`):** `name`, `startDate`, `endDate` (`YYYY-MM-DD`) and `entries[]` with `date`, `productId` (24 hex), optional `sizeId` (24 hex or `null`) and `quantity` (integer ≥ 0). A `version` in the body is accepted (integer ≥ 1) but ignored.
3. **Business rules:** `createForecast` reads the active products and predefined pizzas through the catalogue reader (`AiDataRepository`) and calls `findForecastProblems`, which returns every problem with its field (`entries[2].sizeId`) and code (`dateInvalid`, `periodInvalid`, `noEntries`, `dateOutside`, `productUnknown`, `sizeRequired`, `sizeIncompatible`, `duplicate`).
4. **Version:** `forecastRepository.getLatestVersion(name)` returns the highest version of the name, ignoring case and counting inactive versions, or 0. The forecast is created with that number + 1, `sizeId: null` when absent and `isActive: true`. The unique index `{ name, version }` turns a concurrent save into 409.

On 201 the page shows the toast "“name” vN was saved.", refreshes the list and opens the detail of the new version. On a validation error the violations are shown per field: the page turns `entries[0].date` into `entries.0.date` and translates the codes (`feedback.validation.ai_<code>`). The errors are also listed in the summary at the top of the form (`FormErrors`), which shows any other failure too, because WEB07 requests are `silent` (no global toast).

Saving a forecast with an existing name is [UC3 - Edit Forecast (new version)](./edit-forecast.md).

## Diagram

```mermaid
---
title: "UC1 - Create Forecast - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant panel as ForecastsPanel<br/>[Component: React, TanStack Query]
        participant form as ForecastForm<br/>[Component: React form]
        participant model as forecast-model<br/>[Component: JavaScript module]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as ForecastController<br/>[Component: Controller]
        participant service as ForecastService<br/>[Component: Service]
        participant catalogue as AiDataRepository<br/>[Component: Catalogue reader, MongoDB/mock]
        participant rules as Forecast rules<br/>[Component: Node.js module, pure functions]
        participant repo as ForecastRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>panel: Presses "New forecast"
    activate panel
    panel->>form: Open the empty editor (product options of the catalogue)
    deactivate panel
    activate form
    manager->>form: Fills in name, period and entries, presses Save
    form->>model: validateForecast(form, options)
    activate model
    model-->>form: Problems { field, type }
    deactivate model

    alt Problems found in the browser
      form-->>manager: Mark the fields, focus the first one (no request is sent)
    else Form is valid
      form->>model: toPayload(form)
      model-->>form: Body without version
      form->>route: POST /forecasts
      activate route
      route->>route: requirePermission(Permission.FORECASTS_WRITE)
      route->>route: Validate the body (Joi forecastSchema, stripUnknown)

      alt Body rejected by Joi
        route-->>form: 400 BAD_REQUEST (details: field with dots, Joi type)
      else Body accepted
        route->>controller: create(req, res, next, forecastRepository, catalogueReader)
        activate controller
        controller->>service: createForecast(body, forecastRepository, catalogueReader)
        activate service
        service->>catalogue: listProducts() and listPredefinedPizzas()
        activate catalogue
        catalogue-->>service: Active products and pizzas (sizeIds)
        deactivate catalogue
        service->>rules: findForecastProblems(data, { products, pizzas })
        activate rules
        rules-->>service: Problems { field, type, message }
        deactivate rules

        alt Business rule broken
          service-->>controller: AppError(400, VALIDATION_ERROR, problems)
        else Valid forecast
          service->>repo: getLatestVersion(name)
          activate repo
          repo-->>service: Highest version of the name (0 if none)
          service->>repo: create({ name, version: n + 1, startDate, endDate, entries, isActive: true })
          alt Duplicate key (concurrent save)
            repo-->>service: Error 11000
            service-->>controller: AppError(409, "Forecast version already exists. Try again.")
          else Created
            repo-->>service: Forecast document
            service->>service: toForecastDto(forecast)
            service-->>controller: Forecast DTO
          end
          deactivate repo
        end
        deactivate service
        controller-->>form: Response (201 Created or error)
        deactivate controller
      end
      deactivate route

      alt 201 Created
        form->>panel: onSaved(forecast)
        activate panel
        panel-->>manager: Toast "“name” vN was saved.", refresh the list, show the detail
        deactivate panel
      else 400 validation error
        form-->>manager: Show the violations per field (entries[0].date becomes entries.0.date)
      else Other error (409, 401, 403, network)
        form-->>manager: Show the error in the summary at the top of the form (form stays open)
      end
    end
    deactivate form
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
