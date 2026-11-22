# VIS07 UC1 - Pan the Camera

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 2 (Container) |
| SAD view | Process View, Level 2 |
| Containers | Web Application, 3D Visualization |
| Endpoints | None (client-side only). The kitchen dimensions come from `GET /kitchen-configurations/active` (see [WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)). |
| Allowed roles | Users with the `kitchen:read` permission (MANAGER), who see the viewer on `/visualization3d` and `/kitchen-configurations` |
| Success response | n/a (the view slides parallel to the floor) |
| Error handling | Pan past the limits: the target stops at the floor bounds plus the margin. Move into an object: the last allowed position is restored. |
| ADRs | [ADR-0054](../../adr/0054-perspective-camera-controls-with-limits-derived-from-the-kitchen.md), [ADR-0030](../../adr/0030-adoption-of-r3f-for-3d-module-integration.md) |

## Description

The Manager left-clicks on the viewer and drags. The `OrbitControls` maps the left button to pan (`MOUSE.PAN`) with `screenSpacePanning = false`, so the target and the camera slide on a plane parallel to the floor and the camera height does not change. The movement is scaled by `panSpeed` 0.6 and smoothed by damping (`dampingFactor` 0.08): one `update()` per frame keeps it moving for a short time after the mouse is released.

On every `update()` that moves the camera, the controls dispatch `change`. The handler first applies the pan limit (`constrainPan`): the target is clamped to `x ∈ ±(width / 2 + m)` and `z ∈ ±(length / 2 + m)` (margin `m = 0.05 × max(width, length)`) and kept at `y = 0`, and the camera is moved by the same offset, so the view direction and distance stay the same and there is no jump. It then checks that the camera is outside every obstacle box and above 0.3 m (`isCameraPositionAllowed`); if not, the last allowed position and target are restored.

## Diagram

```mermaid
---
title: "VIS07 UC1 - Pan the Camera - C4 Dynamic, Level 2 (Container)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    participant viz as 3D Visualization<br/>[Container: WebGL, Three.js]

    Note over spa,viz: Kitchen already rendered with the active configuration (VIS05 UC1, WEB06 UC3)
    activate manager
    manager->>viz: Left-click and drag on the canvas
    activate viz
    loop Every frame while moving (damping 0.08)
        viz->>viz: OrbitControls.update(): pan target and camera parallel to the floor (panSpeed 0.6)
        viz->>viz: "change": constrainPan(target, camera, panBounds)
        opt Target outside the floor plus the margin
            viz->>viz: Clamp the target, move the camera by the same offset
        end
        viz->>viz: isCameraPositionAllowed(camera, obstacle boxes)
        alt Inside an object or under 0.3 m
            viz->>viz: Restore the last allowed position and target
        else Allowed
            viz->>viz: Record it as the last allowed position
        end
        viz->>viz: Render the frame
    end
    viz-->>manager: Kitchen seen from the panned viewpoint
    deactivate viz
    deactivate manager
```

See the [README](./README.md) for the notation key, the limits and the element catalogue.
