# VIS03 UC1 - View the Automated Assembly Line

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, 3D Visualization, Back-end API, Database |
| Endpoints | `GET /kitchen-configurations/active` ([WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)), then `GET /assembly-line-configurations/{id}` with the `configurationId` of `content.assemblyLine` |
| Allowed roles | Users with the `kitchen:read` permission (MANAGER, EMPLOYEE), required by the `/visualization3d` and `/kitchen-configurations` routes and by both endpoints |
| Success response | 200 OK, the assembly line configuration `{ id, name, content: { dimensions, elements[] }, ... }`; the line is drawn at the placement of the kitchen |
| Error handling | No active configuration: empty state, no scene (WEB06). Line not loaded (404, 403, network): the kitchen is drawn without the line and the viewer shows "This kitchen's assembly line could not be loaded and is not shown." with the reason; no other line is drawn in its place. Kitchen without `content.assemblyLine`: the kitchen is drawn without a line |
| ADRs | [ADR-0031](../../adr/0031-assembly-line-referenced-by-kitchen.md), [ADR-0025](../../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md), [ADR-0030](../../adr/0030-adoption-of-r3f-for-3d-module-integration.md) |

## Description

The Manager (or an Employee) opens the 3D Visualization page or the Kitchen Configuration page, which both render `KitchenViewer`.

1. `useKitchenConfiguration().loadActive()` reads the active kitchen configuration ([WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)).
2. When the kitchen has `content.assemblyLine`, `loadAssemblyLine` asks the back end for the referenced line by its id. The back end checks `kitchen:read` and the id, and returns the stored line (404 if it does not exist). The answer is kept together with the placement of the kitchen (`position` and `rotation` in the kitchen frame). A failure is shown as a warning; the kitchen is still drawn.
3. `KitchenScene` draws the floor, the walls and the kitchen elements, and the `AssemblyLine` group (`assembly-line-<id>`) at the placement of the kitchen. Inside it, each line element is a `SceneElement` positioned, rotated and scaled in the line frame.
4. `SceneElementModel` picks the procedural model of the element type: counter, receiving platform, overhead crust dispenser, conveyor belt (its length from `scale.x`, slats added, not stretched), robotic arm or wood-fired oven. Each one is a group named after the element id; the dispenser, the belt and the arms have named parts with their pivot at the joint, ready for the Sprint 3 animations.
5. Each element is drawn with its own textured material ([VIS04 UC1](../textures-and-materials/view-textured-models.md)) and receives the lighting of VIS05.

The default line proposed by the SPA, and the one in the back-end fixture, has the VIS03 arrangement: receiving platform and overhead dispenser on the left, conveyor belt along a 9 m counter, six robotic arms behind the belt and the wood-fired oven on the right. A new line is placed against the back wall of the kitchen, centred.

## Diagram

```mermaid
---
title: "VIS03 UC1 - View the Automated Assembly Line - C4 Dynamic, Level 3 (Component)"
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
        participant service as AssemblyLineConfigurationService<br/>[Component: Service]
        participant repo as AssemblyLineConfigurationRepository<br/>[Component: Repository, MongoDB]
    end
    box rgba(200,160,100,0.15) 3D Visualization [Container: WebGL, Three.js]
        participant scene as KitchenScene<br/>[Component: R3F Canvas]
        participant line as AssemblyLine<br/>[Component: R3F group]
        participant models as VIS03 models<br/>[Component: R3F meshes]
    end

    activate staff
    staff->>viewer: Opens /visualization3d (or the Kitchen Configuration page)
    activate viewer
    viewer->>hook: loadActive()
    activate hook
    Note over hook: GET /kitchen-configurations/active, see WEB06 UC3
    alt No active configuration
      hook-->>viewer: Error
      viewer-->>staff: "No active kitchen configuration to display." (no scene)
    else Configuration with content.assemblyLine
      hook->>route: GET /assembly-line-configurations/{configurationId}
      activate route
      route->>route: requirePermission(kitchen:read), validate the id
      route->>service: getConfigurationById(id)
      activate service
      service->>repo: findById(id)
      activate repo
      repo-->>service: Line or null
      deactivate repo
      service-->>route: Line DTO, or AppError 404
      deactivate service
      route-->>hook: 200 OK (line) or error
      deactivate route
      alt Line loaded
        hook-->>viewer: activeConfig, assemblyLine = { ...line, placement }
      else 404, 403 or network failure
        hook-->>viewer: activeConfig, assemblyLineError (translated)
        viewer-->>staff: Warning "assembly line could not be loaded" (the kitchen is still drawn)
      end
      deactivate hook
      viewer->>scene: KitchenScene(config, assemblyLine)
      activate scene
      scene->>scene: Floor, walls, kitchen elements, lighting (VIS05)
      opt Assembly line loaded
        scene->>line: AssemblyLine(line): group "assembly-line-<id>" at placement.position / rotation
        activate line
        loop Each element of the line
          line->>models: SceneElement: position, rotation (degrees), scale in the line frame
          activate models
          models->>models: Model of the type, group named after element.id
          Note over models: counter, receiving-platform, crust-dispenser (crust-stack, release),<br/>conveyor-belt (belt, rollers; length = scale.x), robotic-arm (base → shoulder → elbow → wrist),<br/>wood-fired-oven. Material: see VIS04 UC1
          deactivate models
        end
        deactivate line
      end
      scene-->>staff: Kitchen with the assembly line on its wall
      deactivate scene
    end
    deactivate viewer
    deactivate staff
```

See the [README](./README.md) for the notation key and the element catalogue.
