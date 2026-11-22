# VIS02 UC1 - View the Kitchen Layout

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, 3D Visualization, Back-end API, Database |
| Endpoints | `GET /kitchen-configurations/active` ([WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)) |
| Allowed roles | Users with the `kitchen:read` permission (MANAGER, EMPLOYEE), required by the `/visualization3d` and `/kitchen-configurations` routes and by the endpoint |
| Success response | 200 OK, `{ id, name, content: { dimensions, floor, elements[], assemblyLine? }, isActive: true }`; the kitchen is drawn and its name is shown ("Showing: …") |
| Error handling | No active configuration (404) or the request fails: "No active kitchen configuration to display." and no scene; no other layout is drawn in its place ([ADR-0030](../../adr/0030-active-configuration-endpoint-and-no-fallback-policy.md)). An element without `position`, `rotation` or `scale` is skipped (the back end never stores one) |
| ADRs | [ADR-0030](../../adr/0030-active-configuration-endpoint-and-no-fallback-policy.md), [ADR-0025](../../adr/0025-strorage-model-of-kitchen-configurations.md), [ADR-0039](../../adr/0039-adoption-of-r3f-for-3d-module-integration.md), [ADR-0055](../../adr/0055-ui-consistency-and-input-validation-after-the-sprint-2-review.md) |

## Description

The Manager (or an Employee) opens the 3D Visualization page or the Kitchen Configuration page, which both render `KitchenViewer`.

1. `useKitchenConfiguration().loadActive()` reads the active kitchen configuration ([WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)). The back end checks `kitchen:read` and returns the configuration marked active, or 404. While it loads, the viewer shows the loading placeholder (WEB04).
2. Without an active configuration the viewer shows "No active kitchen configuration to display." and draws nothing.
3. With a configuration, `KitchenScene` computes the camera from the kitchen size (VIS07) and draws:
   - the **floor**, a plane of `width × length` centred at the origin, with the floor material of the JSON (VIS04);
   - the **walls**, four textured planes as high as the kitchen, facing the room, so the camera can look at the kitchen from outside;
   - each **element** of `content.elements` as a `SceneElement`: its material (VIS04), its position (metres, origin at the centre of the floor), its rotation (degrees, converted to radians) and its scale (its size in metres). `SceneElementModel` chooses the model: the furniture of `model` (work table, fridge, shelves, cabinet, ingredient bins, dough trays, built at their real size), the stone/dome wood-fired oven for `equipment`, a frame with a belt for the generic `assembly-line` type, and a box for any other element;
   - the assembly line of `content.assemblyLine` (VIS03, [View the Automated Assembly Line](../assembly-line/view-assembly-line.md)).
4. Every element is a camera obstacle (VIS07) and casts and receives shadows under the scene lighting (VIS05). The viewer shows the name of the configuration above the scene.

Every element is drawn inside the kitchen, because the back end rejects positions outside it and sizes larger than it when the configuration is saved (WEB06, [ADR-0055](../../adr/0055-ui-consistency-and-input-validation-after-the-sprint-2-review.md) D7). After another configuration is activated, the viewer is remounted and the flow starts again ([ADR-0032](../../adr/0032-viewer-reload-mechanism-in-the-frontend.md)).

## Diagram

```mermaid
---
title: "VIS02 UC1 - View the Kitchen Layout - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor staff as Manager / Employee<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant viewer as KitchenViewer<br/>[Component: React component]
        participant hook as useKitchenConfiguration<br/>[Component: React hook]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: Router and middleware]
        participant service as KitchenConfigurationService<br/>[Component: Service]
        participant repo as KitchenConfigurationRepository<br/>[Component: Repository, MongoDB]
    end
    box rgba(200,160,100,0.15) 3D Visualization [Container: WebGL, Three.js]
        participant scene as KitchenScene<br/>[Component: R3F Canvas]
        participant element as SceneElement<br/>[Component: R3F group]
        participant models as Kitchen models<br/>[Component: R3F meshes]
    end

    activate staff
    staff->>viewer: Opens /visualization3d (or the Kitchen Configuration page)
    activate viewer
    viewer->>hook: loadActive()
    activate hook
    viewer-->>staff: Loading placeholder (WEB04)
    hook->>route: GET /kitchen-configurations/active
    activate route
    route->>route: requirePermission(kitchen:read)
    route->>service: getActiveConfiguration(repo)
    activate service
    service->>repo: getActive()
    activate repo
    repo-->>service: Active configuration or null
    deactivate repo
    service-->>route: Configuration DTO, or AppError 404
    deactivate service
    route-->>hook: 200 OK (configuration) or 404
    deactivate route
    deactivate hook
    alt No active configuration or request failed
      hook-->>viewer: error
      viewer-->>staff: "No active kitchen configuration to display." (no scene, no default layout)
    else Active configuration
      hook-->>viewer: activeConfig (and the assembly line, VIS03)
      viewer->>scene: KitchenScene(config, assemblyLine)
      activate scene
      scene->>scene: Camera from dimensions (VIS07), lighting (VIS05/VIS06)
      scene->>scene: Floor plane width × length with floor.material (VIS04)
      scene->>scene: Four walls as high as the kitchen, facing the room (VIS04)
      loop Each element of content.elements
        scene->>element: SceneElement(element): material (VIS04)
        activate element
        element->>element: position (m), rotation (degrees → radians), scale (size in m)
        alt element.model (work-table, fridge, shelves, cabinet, ingredient-bins, dough-trays)
          element->>models: Furniture model built at the size given by scale, group named after element.id
        else type equipment
          element->>models: Stone base and dome (wood-fired oven), scaled
        else type assembly-line
          element->>models: Frame and belt, scaled
        else other
          element->>models: Box, scaled
        end
        Note over element,models: Camera obstacle (VIS07), shadows (VIS05)
        deactivate element
      end
      opt content.assemblyLine
        Note over scene: Assembly line group, see VIS03 UC1
      end
      scene-->>staff: Kitchen of the active configuration, "Showing: <name>"
      deactivate scene
    end
    deactivate viewer
    deactivate staff
```

See the [README](./README.md) for the layout properties, the models, the notation key and the element catalogue.
