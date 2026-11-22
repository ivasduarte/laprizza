# VIS07 UC2 - Orbit the Camera

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 2 (Container) |
| SAD view | Process View, Level 2 |
| Containers | Web Application, 3D Visualization |
| Endpoints | None (client-side only). The kitchen dimensions come from `GET /kitchen-configurations/active` (see [WEB06 UC3](../kitchen-configuration/get-active-kitchen-configuration.md)). |
| Allowed roles | Users with the `kitchen:read` permission (MANAGER), who see the viewer on `/visualization3d` and `/kitchen-configurations` |
| Success response | n/a (the camera turns around the current target) |
| Error handling | Orbit past the limits: the camera stops at the polar or azimuth limit. Move into an object: the last allowed position is restored. |
| ADRs | [ADR-0050](../../adr/0050-perspective-camera-controls-with-limits-derived-from-the-kitchen.md), [ADR-0039](../../adr/0039-adoption-of-r3f-for-3d-module-integration.md) |

## Description

The Manager right-clicks on the viewer and drags. The browser context menu does not open, because `CameraControls` cancels the `contextmenu` event on the canvas. The `OrbitControls` maps the right button to rotate (`MOUSE.ROTATE`): the camera turns around the **current** target (the centre of the floor, or wherever the last pan left it), at the same distance, scaled by `rotateSpeed` 0.5 and smoothed by damping.

On every `update()`, the controls clamp the spherical coordinates of the camera around the target:

- **Polar angle** (from the vertical) between 0.1 rad (≈ 6°), so the camera is never exactly overhead, where it would flip, and `90° − fov / 2` (65°), so the top edge of the view is at most horizontal: the camera never sees above its own height and always stays above the floor.
- **Azimuth** between −135° and +135° around the initial side (+Z), so the orbit never makes a full turn.

The `change` handler then applies the same pan limit and obstacle check as [UC1](./pan-camera.md).

## Diagram

```mermaid
---
title: "VIS07 UC2 - Orbit the Camera - C4 Dynamic, Level 2 (Container)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    participant spa as Web Application<br/>[Container: React, Vite]
    participant viz as 3D Visualization<br/>[Container: WebGL, Three.js]

    Note over spa,viz: Kitchen already rendered with the active configuration (VIS05 UC1, WEB06 UC3)
    activate manager
    manager->>viz: Right-click and drag on the canvas
    activate viz
    viz->>viz: contextmenu cancelled (no browser menu)
    loop Every frame while moving (damping 0.08)
        viz->>viz: OrbitControls.update(): rotate around the current target (rotateSpeed 0.5)
        viz->>viz: Clamp polar angle to [6°, 65°] and azimuth to [−135°, +135°]
        viz->>viz: "change": pan limit and obstacle check (see UC1)
        opt Inside an object or under 0.3 m
            viz->>viz: Restore the last allowed position and target
        end
        viz->>viz: Render the frame
    end
    viz-->>manager: Kitchen seen from the new angle, never from below or above the camera height
    deactivate viz
    deactivate manager
```

See the [README](./README.md) for the notation key, the limits and the element catalogue.
