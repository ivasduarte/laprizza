# UC6 - Delete Configuration

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoint | `DELETE /kitchen-configurations/{id}` |
| Allowed roles | MANAGER |
| Success response | 204 No Content |
| Error handling | 400 (invalid id format), 401/403 (no valid token or role not allowed), 404 (not found), 409 (Cannot delete active configuration) |
| ADRs | [ADR-0024](../../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md) |

## Description

A Manager removes a stored configuration. To prevent the system from ending up without a layout to render in the 3D module, the active configuration cannot be deleted. If a deletion attempt targets the active configuration, the API returns a 409 Conflict error. In the Web Application, the delete action is hidden for the active layout.

## Diagram

```mermaid
---
title: "UC6 - Delete Configuration - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as KitchenConfigurationPage<br/>[Component: React page]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & RBAC)<br/>[Component: Router and middleware]
        participant controller as KitchenConfigurationController<br/>[Component: Controller]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB/mock]
    end

    activate manager
    manager->>page: Clicks "Delete" and confirms
    activate page
    page->>route: DELETE /kitchen-configurations/{id}
    activate route
    route->>route: verifyToken() & requireRole([MANAGER])
    route->>route: Validate id format
    route->>controller: remove(req, res, next, repo)
    activate controller
    
    controller->>service: removeConfiguration(id, repo)
    activate service
    service->>repo: findById(id)
    repo-->>service: KitchenConfiguration Entity
    
    alt Configuration is active
        service-->>controller: AppError(409, "Cannot delete the active kitchen configuration.")
    else Configuration is inactive
        service->>repo: remove(id)
        repo-->>service: Null
        service-->>controller: Success (void)
    end
    deactivate service
    
    alt Success
        controller-->>page: 204 No Content
    else Conflict (409) or Not Found (404)
        controller-->>page: Error Response
    end
    deactivate controller
    deactivate route
    
    page-->>manager: Refresh list or display error message
    deactivate page
    deactivate manager
```