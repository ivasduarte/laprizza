# UC8 - Deactivate Supplier Scenario

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `PUT /supplier-scenarios/{id}` with body `{ "isActive": false }` |
| Allowed roles | MANAGER (permission `suppliers:import`) |
| Success response | 200 OK, supplier scenario DTO with `isActive: false` |
| Error handling | 400 `BAD_REQUEST` (invalid id format, or a body other than `{ "isActive": false }`), 404 `NOT_FOUND` "Supplier Scenario not found." (unknown or already inactive), 401/403 |
| ADRs | [ADR-0046](../../adr/0046-immutable-versioned-forecasts-and-supplier-scenarios.md) |

## Description

Same soft delete as [UC4](./deactivate-forecast.md), for supplier scenarios. In `ScenariosCard` the Manager presses "Deactivate" and confirms the dialog "Deactivate “name” vN? It is no longer used in new calculations. Saved results are kept." The page sends `PUT /supplier-scenarios/{id}` with `{ "isActive": false }`. The route checks the permission, the id and the body (only `isActive: false`), and `updateSupplierScenario` loads the scenario (404 if missing or already inactive) and sets `isActive: false`.

The document stays in the database. It is no longer listed nor offered in the execution form, it is no longer the default scenario of an execution (the back end takes the most recently created active one), and an execution that asks for it by id answers 404 `SUPPLIER_SCENARIO_NOT_FOUND`. Saved runs keep its `{ id, name, version }`. The version number is never reused.

On success the page shows "Supplier scenario “name” vN deactivated.", refreshes the list and closes the preview if it showed that scenario. A 404 also refreshes the list (already deactivated elsewhere); other errors are shown above the list.

## Diagram

```mermaid
---
title: "UC8 - Deactivate Supplier Scenario - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant card as SuppliersPanel (ScenariosCard)<br/>[Component: React, TanStack Query]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as SupplierScenarioController<br/>[Component: Controller]
        participant service as SupplierScenarioService<br/>[Component: Service]
        participant repo as SupplierScenarioRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>card: Presses "Deactivate" on "name" vN
    activate card
    card-->>manager: Confirmation dialog (saved results are kept)

    alt Manager cancels
      card-->>manager: Nothing is sent
    else Manager confirms
      card->>route: PUT /supplier-scenarios/{id} { "isActive": false }
      activate route
      route->>route: requirePermission(Permission.SUPPLIERS_IMPORT)
      route->>route: validateId and Joi deactivateSchema (isActive must be false)
      alt Invalid id or body
        route-->>card: 400 BAD_REQUEST
      else Accepted
        route->>controller: update(req, res, next, scenarioRepository)
        activate controller
        controller->>service: updateSupplierScenario(id, { isActive: false }, scenarioRepository)
        activate service
        service->>repo: findById(id)
        activate repo
        repo-->>service: Active scenario or null
        alt Missing or already inactive
          service-->>controller: AppError(404, "Supplier Scenario not found.")
        else Active
          service->>repo: update(id, { isActive: false })
          repo-->>service: Deactivated document (kept in the database)
          service-->>controller: toSupplierScenarioDto(scenario)
        end
        deactivate repo
        deactivate service
        controller-->>card: 200 OK or 404
        deactivate controller
      end
      deactivate route
      alt 200 OK or 404
        card-->>manager: Toast "Supplier scenario “name” vN deactivated." (200), close its preview, refresh the list
      else Other error
        card-->>manager: Show the error above the list
      end
    end
    deactivate card
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
