# VIS06 UC4 - Reset Lighting

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, 3D Visualization |
| Endpoints | None (client-side only). The settings are not stored and no request is made. |
| Allowed roles | Users with the `kitchen:read` permission (MANAGER), who see the viewer on `/visualization3d` and `/kitchen-configurations` |
| Success response | n/a (the default lighting is restored in the panel and in the scene) |
| Error handling | None |
| ADRs | [ADR-0045](../../adr/0045-lighting-controls-with-lil-gui.md), [ADR-0044](../../adr/0044-scene-lighting-setup.md) |

## Description

The "Reset" button, at the top of the "Lighting" panel, restores the VIS05 look. For each light, `reset()` copies the values of `DEFAULT_LIGHTING` into the panel state (`Object.assign`), so every light is switched on again with its default colour, intensity, cutoff angle and penumbra. It then refreshes every control of every folder (`gui.controllersRecursive().forEach((c) => c.updateDisplay())`), runs `sync()` of each folder to enable again the controls of the lights that were off, and calls `emit()`, which sends a copy of the state to `KitchenScene` through `setLighting`.

The same defaults are also used whenever the viewer is mounted again, because the settings are kept only in memory: `KitchenScene` starts from `DEFAULT_LIGHTING` and `LightingControls` builds a new panel from a copy of it. For example, an activation on the Kitchen Configuration page remounts the viewer ([ADR-0032](../../adr/0032-viewer-reload-mechanism-in-the-frontend.md)) and the lighting goes back to the defaults.

## Diagram

```mermaid
---
title: "VIS06 UC4 - Reset Lighting - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor manager as Manager<br/>[Person]
    box rgba(200,160,100,0.15) 3D Visualization [Container: WebGL, Three.js]
        participant gui as LightingControls<br/>[Component: lil-gui panel]
        participant scene as KitchenScene<br/>[Component: R3F Canvas]
        participant lighting as SceneLighting<br/>[Component: R3F lights]
        participant renderer as Three.js WebGLRenderer<br/>[Component: Three.js]
    end

    activate manager
    manager->>gui: Clicks "Reset"
    activate gui
    loop For each light
      gui->>gui: Object.assign(state[key], DEFAULT_LIGHTING[key])
    end
    gui->>gui: updateDisplay() of every control
    gui->>gui: sync() of every folder (all controls enabled again)
    gui->>scene: emit() = setLighting(structuredClone(state))
    activate scene
    scene->>lighting: SceneLighting(DEFAULT_LIGHTING values)
    activate lighting
    lighting->>lighting: All lights on, default colour, intensity, angle and penumbra
    deactivate lighting
    scene->>renderer: Updated light props
    deactivate scene
    renderer->>renderer: Draw the next frame
    renderer-->>manager: Default lighting (VIS05 look), panel showing the default values
    deactivate gui
    deactivate manager
```

See the [README](./README.md) for the notation key and the element catalogue.
