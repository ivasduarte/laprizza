# UC3 - Get Active Kitchen Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, 3D Visualization, Back-end API, Database, Asset Host |
| Endpoint | `GET /kitchen-configurations/active` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 401/403 (no valid token or role not allowed), 404 (no active configuration; there is no fallback layout) |
| ADRs | [ADR-0021](../../adr/0021-asset-references-strategy.md), [ADR-0025](../../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md) |

## Description

The Kitchen Configuration page is available to Managers (full management) and Employees (read-only: list, consult the JSON and the viewer). When the page is opened, and every time the viewer is remounted (see [UC2](./activate-kitchen-configuration.md)), the embedded `KitchenViewer` requests the active configuration through the `useKitchenConfiguration` hook, which calls the dedicated endpoint.

If no configuration is active, the API fails explicitly with 404 and does not return a hardcoded fallback layout, so a misconfigured system is never masked (ADR-0025). The viewer shows an explicit empty state.

If a configuration is active, it is returned as a single self-contained payload (`id`, `name`, `content`, `isActive`). The 3D scene loads each model and texture directly from the URL/URIs inside it, without secondary requests to the Back-end API (ADR-0021).

**Implementation status:** the `KitchenViewer` is the integration point for the 3D module (VIS01 to VIS07). Until the Three.js scene is plugged in, it fetches the configuration, shows its name or the empty state, and does not load assets. The asset loop in the diagram belongs to the VIS user stories.

## Diagram

```mermaid
---
title: "UC3 - Get Active Kitchen Configuration - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as KitchenConfigurationPage<br/>[Component: React page]
    end
    box rgba(200,160,100,0.15) 3D Visualization [Container: WebGL, Three.js]
        participant viewer as KitchenViewer<br/>[Component: React component, Three.js]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as KitchenConfigurationController<br/>[Component: Controller]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB/mock]
    end
    box rgba(150,150,150,0.15) External System
        participant assets as Asset Host<br/>[External System: URL/URI]
    end

    activate user
    user->>page: Opens the Kitchen Configuration page
    activate page
    page->>viewer: Mount the viewer
    activate viewer
    viewer->>route: GET /kitchen-configurations/active
    activate route
    route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
    route->>controller: getActive(req, res, next, repo)
    activate controller

    controller->>service: getActiveConfiguration(repo)
    activate service

    service->>repo: getActive()
    activate repo
    repo-->>service: KitchenConfiguration Entity (or null)
    deactivate repo

    alt No Active Configuration
      service-->>controller: AppError(404, "No active kitchen configuration found.")
    else Active Configuration Found
      service->>service: toKitchenConfigurationDto(KitchenConfiguration)
      service-->>controller: KitchenConfiguration DTO
    end
    deactivate service

    controller-->>viewer: Response (200 OK or 404 Not Found)
    deactivate controller
    deactivate route

    alt 200 OK
      loop For each model and texture URI in the configuration (VIS stories)
        viewer->>assets: GET asset URI
        assets-->>viewer: Model or texture
      end
      viewer->>viewer: Build the Three.js scene
      viewer-->>user: Show the 3D kitchen
    else 404 Not Found
      viewer-->>user: Show the empty state (no fallback layout)
    end
    deactivate viewer
    deactivate page
    deactivate user
```

See the [README](./README.md) for the notation key and the element catalogue.
