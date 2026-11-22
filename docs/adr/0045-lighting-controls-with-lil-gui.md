# Lighting Controls with lil-gui

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-17

Technical Story: [VIS06] Interactive Light Controls

## Context and Problem Statement

VIS06 asks for a GUI, organised in one folder per light source, to switch each light on and off, change its colour and intensity and, for spotlights, its cutoff angle and penumbra, with the other controls of a light disabled while it is off. lil-gui (bundled with Three.js) is recommended. The scene is rendered with React Three Fiber ([ADR-0039](./0039-adoption-of-r3f-for-3d-module-integration.md)), so we must decide which GUI to use and how its values reach the lights.

## Decision Drivers

* Meet every VIS06 criterion with little code.
* Keep the lights declarative in React (props of the R3F lights).
* No change to the light positions defined in VIS05.

## Considered Options

* React form controls styled for the page
* lil-gui changing the Three.js light objects directly
* lil-gui with its own state, sending a copy to the scene state

## Decision Outcome

Chosen option: "lil-gui with its own state, sending a copy to the scene state".

* `LightingControls` creates the panel once (`new GUI({ title: 'Lighting', container })`), open by default, in the top-right corner of the viewer, with a Reset button and one folder per light (`addFolder`), and destroys it when unmounted.
* The panel edits its own copy of `DEFAULT_LIGHTING` (`structuredClone`). `gui.onChange(emit)` sends a new copy on every change to `onChange`, which is `setLighting` of `KitchenScene`; `SceneLighting` renders the lights from that state.
* The "On" checkbox runs `sync()`, which disables or enables the other controls of the folder. A light that is off gets intensity 0 instead of being removed, so the shaders are not recompiled.
* The angle is edited in degrees and converted to radians in `SceneLighting`.
* The settings are not persisted and call no endpoint.
* lil-gui is imported from Three.js (`three/examples/jsm/libs/lil-gui.module.min.js`).

### Positive Consequences

* Folders, checkboxes, colour pickers, sliders with limits and disabled controls come from lil-gui.
* The lights stay declarative: React is the only owner of what is rendered.
* The panel can be reused by another scene that accepts the same `lighting` object.

### Negative Consequences

* The panel texts are fixed in English and are not translated ([ADR-0019](./0019-internationalization-of-the-web-application-%28english-and-portuguese%29.md)).
* The panel is created imperatively in a `useEffect`, outside the React tree.
* The settings are lost when the viewer is remounted.

## Pros and Cons of the Options

### React form controls

* Good, because the texts would use i18next and the page styles.
* Bad, because folders, colour pickers and slider behaviour must be built and tested by hand.

### lil-gui changing the Three.js objects directly

* Good, because there is no React re-render on each change.
* Bad, because the lights would be changed outside React, and a re-render could overwrite them with the old props.

### lil-gui with its own state, copied to the scene state

* Good, because it combines the ready-made GUI with declarative lights.
* Bad, because every change creates a copy of a small object and re-renders the lights.
