# UC2 - Activate Kitchen Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, 3D Visualization, Back-end API, Database |
| Endpoint | `PATCH /kitchen-configurations/{id}/activate` |
| Allowed roles | MANAGER |
| Success response | 200 OK (also when the configuration is already active; nothing is written) |
| Error handling | 400 (malformed id), 404 (configuration not found, also when it is deleted during the activation), 409 (another activation is in progress), 500 (unexpected failure, generic message without internal details) |
| ADRs | [ADR-0023](../../adr/0023-atomic-activation-strategy.md), [ADR-0027](../../adr/0027-viewer-reload-mechanism-in-the-frontend.md) |

## Description

A Manager makes a stored configuration the active one. Only one configuration can be active at a time, so the switch must be atomic: `KitchenConfigurationRepository.activateAtomic(id)` deactivates the current active configuration and activates the selected one inside a single database transaction, backed by a partial unique index on `isActive: true` (named `active_kitchen_config_unique`, created by the migration and declared in the model with the same name; ADR-0023). The system is therefore never left without an active configuration or with two of them. If the transaction fails, it is aborted and the previous active configuration is kept.

The service translates the repository outcome into HTTP semantics:

| Repository outcome | AppError |
|---|---|
| Target not found before the transaction (`findById` returns `null`) | 404 |
| Target deleted inside the transaction (error code `ACTIVATION_TARGET_NOT_FOUND`) | 404 |
| Duplicate key (`11000`), write conflict (`112`) or `TransientTransactionError` label | 409 "Another activation is in progress." |
| Anything else, or `activateAtomic` returns nothing | 500 "Activation failed." (the original message is not exposed) |

Activating a configuration that is already active is idempotent: the service returns it with 200 without opening a transaction.

After a successful activation the page refreshes the list and changes the React key of the embedded `KitchenViewer`, which remounts it. On mount, the viewer fetches the new active configuration ([UC3 - Get Active Kitchen Configuration](./get-active-kitchen-configuration.md)), without a full page refresh (ADR-0027). The Activate button is only offered to Managers, on configurations that are not active, after a confirmation dialog.

## Diagram

```mermaid
---
title: "UC2 - Activate Kitchen Configuration - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as KitchenConfigurationPage<br/>[Component: React page]
    end
    box rgba(200,160,100,0.15) 3D Visualization [Container: WebGL, Three.js]
        participant viewer as KitchenViewer<br/>[Component: React component]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as KitchenConfigurationController<br/>[Component: Controller]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>page: Selects "Activate" on an inactive configuration
    activate page
    page->>manager: Ask for confirmation (window.confirm)
    manager-->>page: Confirms
    page->>route: PATCH /kitchen-configurations/{id}/activate
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate the ObjectId format (Joi)
    route->>controller: activate(req, res, next, repo)
    activate controller

    controller->>service: activateConfiguration(id, repo)
    activate service

    service->>repo: findById(id)
    activate repo
    repo-->>service: KitchenConfiguration Entity (or null)
    deactivate repo

    alt Configuration Not Found
      service-->>controller: AppError(404)
    else Already active
      service-->>controller: KitchenConfiguration DTO (200, nothing written)
    else Configuration Found and inactive
      service->>repo: activateAtomic(id)
      activate repo
      repo->>repo: Start transaction
      repo->>repo: Deactivate the current active configuration (isActive: false)
      repo->>repo: Activate the selected configuration (isActive: true)

      alt Target deleted meanwhile (ACTIVATION_TARGET_NOT_FOUND)
        repo->>repo: Abort transaction (previous active configuration is kept)
        repo-->>service: Error
        service-->>controller: AppError(404)
      else Duplicate key 11000, WriteConflict 112 or TransientTransactionError
        repo->>repo: Abort transaction (previous active configuration is kept)
        repo-->>service: MongoError
        service-->>controller: AppError(409, "Another activation is in progress.")
      else Any other failure
        repo->>repo: Abort transaction
        repo-->>service: Error
        service-->>controller: AppError(500, "Activation failed.")
      else Success
        repo->>repo: Commit transaction
        repo-->>service: Activated KitchenConfiguration Entity
        service->>service: toKitchenConfigurationDto(KitchenConfiguration)
        service-->>controller: KitchenConfiguration DTO
      end
      deactivate repo
    end
    deactivate service

    controller-->>page: Response (200 OK or Error)
    deactivate controller
    deactivate route

    alt 200 OK
      page->>page: Refresh the list and change the viewer key
      page->>viewer: Remount the viewer (new React key)
      Note over viewer: Fetches and renders the new layout (see UC3)
      page-->>manager: Show the success message
    else Error
      page-->>manager: Show the error (active configuration unchanged)
    end
    deactivate page
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
