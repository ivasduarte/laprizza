# UC5 - Edit Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `PATCH /kitchen-configurations/{id}` |
| Allowed roles | MANAGER |
| Success response | 200 OK |
| Error handling | 400 (Validation error), 401/403 (no valid token or role not allowed), 404 (not found) |
| ADRs | [ADR-0022](../../adr/0022-content-validation-strategy.md), [ADR-0024](../../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md), [ADR-0027](../../adr/0027-viewer-reload-mechanism-in-the-frontend.md) |

## Description

A Manager edits an existing kitchen configuration. The new content is subject to the same structural (JSON Schema) and domain (unique ids, valid references) validations as creation. Editing the active configuration is permitted; upon success, the frontend remounts the viewer to fetch and render the updated layout without requiring a full page refresh.

## Diagram

```mermaid
---
title: "UC5 - Edit Configuration - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant form as KitchenConfigurationForm<br/>[Component: React form]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as KitchenConfigurationController<br/>[Component: Controller]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant domain as KitchenConfigurationDomain<br/>[Component: Domain, JSON Schema (Ajv)]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>form: Edits JSON and presses Save
    activate form
    form->>route: PATCH /kitchen-configurations/{id}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate payload (Joi)
    route->>controller: update(req, res, next, repo)
    activate controller
    
    controller->>service: updateConfiguration(id, data, repo)
    activate service
    service->>repo: findById(id)
    repo-->>service: Existing KitchenConfiguration
    
    service->>domain: validateKitchenConfigurationContent(data.content)
    activate domain
    domain->>domain: Validate structure (JSON Schema) and business rules
    domain-->>service: Validated data / DomainError (details)
    deactivate domain
    
    alt Validation Failed
        service-->>controller: AppError(400, details)
    else Validation Passed
        service->>repo: update(id, dataToSave)
        repo-->>service: Updated KitchenConfiguration
        service->>service: toKitchenConfigurationDto()
        service-->>controller: KitchenConfiguration DTO
    end
    deactivate service
    
    controller-->>form: Response (200 OK or 400 Bad Request)
    deactivate controller
    deactivate route
    
    alt 200 OK
        form-->>manager: Close form and refresh list/viewer
    else 400 Bad Request
        form-->>manager: Show validation errors
    end
    deactivate form
    deactivate manager
```