# UC4 - List and Consult Configurations

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | `GET /kitchen-configurations`, `GET /kitchen-configurations/{id}` |
| Allowed roles | MANAGER, EMPLOYEE |
| Success response | 200 OK |
| Error handling | 400 (invalid id format), 401/403 (no valid token or role not allowed), 404 (not found) |
| ADRs | [ADR-0025](../../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md) |

## Description

Managers and Employees can retrieve the list of stored kitchen configurations, which includes their activation status, and consult the full JSON content of a specific configuration. The Web Application hides the Create, Edit, Activate, and Delete controls for users with the Employee role, providing a read-only view.

## Diagram

```mermaid
---
title: "UC4 - List and Consult Configurations - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as Manager / Employee<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as KitchenConfigurationPage<br/>[Component: React page]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as KitchenConfigurationController<br/>[Component: Controller]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate user
    user->>page: Accesses the configurations page or clicks "View"
    activate page
    
    alt List Configurations
        page->>route: GET /kitchen-configurations
        activate route
        route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
        route->>controller: list(req, res, next, repo)
        activate controller
        controller->>service: listConfigurations(repo)
        activate service
        service->>repo: list()
        activate repo
        repo-->>service: Array of KitchenConfiguration Entities
        deactivate repo
        service->>service: Map to DTOs
        service-->>controller: Array of KitchenConfiguration DTOs
        deactivate service
        controller-->>page: 200 OK (Array of configurations)
        deactivate controller
        deactivate route
    else Consult Specific Configuration
        page->>route: GET /kitchen-configurations/{id}
        activate route
        route->>route: verifyToken() & requireRole([MANAGER, EMPLOYEE])
        route->>controller: getById(req, res, next, repo)
        activate controller
        controller->>service: getConfigurationById(id, repo)
        activate service
        service->>repo: findById(id)
        activate repo
        repo-->>service: KitchenConfiguration Entity
        deactivate repo
        service->>service: toKitchenConfigurationDto(KitchenConfiguration)
        service-->>controller: KitchenConfiguration DTO
        deactivate service
        controller-->>page: 200 OK (Configuration DTO)
        deactivate controller
        deactivate route
    end
    
    page-->>user: Displays the configurations list or JSON details
    deactivate page
    deactivate user
```