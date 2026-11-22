# UC7 - List and Consult Supplier Scenarios

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `GET /supplier-scenarios[?name=]` (list, optional search by name), `GET /supplier-scenarios/{id}` (one version) |
| Allowed roles | MANAGER (permission `suppliers:read`) |
| Success response | 200 OK, array of supplier scenario DTOs (active versions only) or one DTO `{ id, name, version, simulated, suppliers[], products[], isActive }` |
| Error handling | 400 `BAD_REQUEST` (invalid query or id format), 404 `NOT_FOUND` "Supplier Scenario not found." (unknown or inactive id), 401/403 |
| ADRs | [ADR-0046](../../adr/0046-immutable-versioned-forecasts-and-supplier-scenarios.md) |

## Description

`ScenariosCard`, in the Suppliers tab, loads `GET /supplier-scenarios`. As for the forecasts, the repository returns only active versions sorted by name and version (or searches by name, case-insensitive), the service filters the active ones again and maps them with `toSupplierScenarioDto` (an offer without `supplyLimit` has no such field). The card explains that a calculation uses the scenario chosen in the execution, by default the latest one, and shows for each version its name, version, number of suppliers and number of products, with View and Deactivate.

"View" shows the scenario with `SupplierPreview`, built from the list data and the product export loaded by the tab ([UC5](./export-products.md)): one row per offer with supplier name, price, stock units, price per unit, lead time, supply limit ("No limit" when absent) and the tag "Simulated", and a "No configured supplier" row for every product of the scenario without offers and every exported product that the scenario does not mention.

`GET /supplier-scenarios/{id}` is available through the API: 400 for an id that is not 24 hex characters and 404 when the scenario does not exist or is inactive (`getSupplierScenarioById`).

## Diagram

```mermaid
---
title: "UC7 - List and Consult Supplier Scenarios - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant card as SuppliersPanel (ScenariosCard)<br/>[Component: React, TanStack Query]
        participant preview as SupplierPreview<br/>[Component: React component]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant controller as SupplierScenarioController<br/>[Component: Controller]
        participant service as SupplierScenarioService<br/>[Component: Service]
        participant repo as SupplierScenarioRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager

    alt List the scenarios (page)
      manager->>card: Opens the Suppliers tab
      activate card
      card->>route: GET /supplier-scenarios
      activate route
      route->>route: requirePermission(Permission.SUPPLIERS_READ)
      route->>route: Validate the query (Joi: optional name)
      route->>controller: list(req, res, next, scenarioRepository)
      activate controller
      controller->>service: listSupplierScenarios(query, scenarioRepository)
      activate service
      service->>repo: list() or search(name)
      activate repo
      repo-->>service: Active scenarios, sorted by name and version
      deactivate repo
      service->>service: Keep the active ones, toSupplierScenarioDto(each)
      service-->>controller: Array of DTOs
      deactivate service
      controller-->>card: 200 OK
      deactivate controller
      deactivate route
      card-->>manager: Table (name, version, suppliers, products)
      manager->>card: Presses "View"
      card->>preview: scenario (list data) and exported products
      activate preview
      preview->>preview: buildPreviewRows(scenario, exported)
      preview-->>manager: Offers tagged "Simulated", "No configured supplier" rows
      deactivate preview
      deactivate card
    else Consult one version (API)
      manager->>route: GET /supplier-scenarios/{id}
      activate route
      route->>route: requirePermission(Permission.SUPPLIERS_READ) and validateId
      alt Invalid id
        route-->>manager: 400 BAD_REQUEST "Invalid ID format"
      else Valid id
        route->>controller: getById(req, res, next, scenarioRepository)
        activate controller
        controller->>service: getSupplierScenarioById(id, scenarioRepository)
        activate service
        service->>repo: findById(id)
        activate repo
        repo-->>service: Active scenario or null
        deactivate repo
        alt Missing or inactive
          service-->>controller: AppError(404, "Supplier Scenario not found.")
        else Found
          service-->>controller: toSupplierScenarioDto(scenario)
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
