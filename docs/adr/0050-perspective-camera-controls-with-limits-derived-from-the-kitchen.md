# Perspective Camera Controls with Limits Derived from the Kitchen

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-19

Technical Story: [VIS07] Perspective Camera Interaction

## Context and Problem Statement

VIS07 asks the Manager to explore the kitchen with a perspective camera and the mouse: the initial target is the centre of the kitchen floor, left drag pans, right drag orbits around the target, the wheel dollies, all within reasonable limits and without jitter or excessive sensitivity. Until VIS06, the scene used the `OrbitControls` of `@react-three/drei` with the default mouse buttons (left orbits, right pans), fixed limits (minimum distance 2, polar angle just under 90°) and no pan limit. The kitchens have different sizes ([ADR-0025](./0025-strorage-model-of-kitchen-configurations.md)), so fixed limits fit some kitchens and not others. We must decide which controls to use, where the limits come from and how they are enforced.

## Decision Drivers

* Meet every VIS07 criterion: mouse mapping, initial target, pan, orbit and dolly limits, smooth movement.
* Limits that fit any kitchen size of the active configuration.
* The camera never leaves the kitchen, never goes under the floor and never looks above its own height.
* Calculations that can be unit tested without a browser or WebGL.
* Proper clean-up when the viewer is unmounted, including the double mount of React `StrictMode`.

## Considered Options

* Keep the drei `OrbitControls` with props
* Three.js `OrbitControls` (`three/examples/jsm/controls/OrbitControls.js`) in a component of our own, with limits computed by pure functions
* A custom camera controller written from scratch

## Decision Outcome

Chosen option: "Three.js `OrbitControls` in a component of our own, with limits computed by pure functions".

* `camera-view.js` holds pure functions (no React, no Three.js). `computeCameraSetup(dimensions, fov)` returns the initial view, the dolly and angle limits, `near`/`far` and the pan bounds from `content.dimensions`. `constrainPan(target, position, bounds)` clamps the target to the floor and moves the camera by the same offset. `isCameraPositionAllowed(position, boxes)` checks the minimum height and the obstacles.
* `CameraControls` (`camera-controls.jsx`), rendered inside the R3F `Canvas`, creates the controls in a `useEffect` with the R3F camera (`PerspectiveCamera`, fov 50°) and canvas, calls `update()` on every frame (`useFrame` with priority −1, so R3F keeps rendering) and disposes them on clean-up.
* Mouse mapping: `LEFT: PAN`, `MIDDLE: DOLLY`, `RIGHT: ROTATE`; `screenSpacePanning = false` (pan parallel to the floor); `zoomToCursor = false` (the wheel dollies towards the target); damping on; the browser context menu is disabled on the canvas.
* The origin is the centre of the kitchen floor (VIS02 draws the kitchen centred on `(0, 0, 0)`, floor at `y = 0`), so the initial target is `(0, 0, 0)`.
* Limits are applied in two places: the distance and angle limits by `OrbitControls` itself on every `update()`, and the pan limit and the obstacle check on its `change` event, after the camera has looked at the target, so moving target and camera together causes no jump.
* The maximum polar angle is `90° − fov/2` (65°): the top edge of the view is at most horizontal, so the camera never sees above its own height and always stays above the floor. The orbit is limited to ±135° around the initial side.
* The camera cannot go through the configuration elements: their bounding boxes (objects marked with `userData.cameraBlocker`, expanded by 0.25 m) are checked on every change, and the last allowed position and target are restored when a move would enter one or go under 0.3 m. The walls are not obstacles: the kitchen is seen from outside, like a dollhouse.
* "Reset view" moves the camera to the initial view after flushing the pending inertia (one `update()` without damping), so it stops exactly there.
* When the dimensions change, the setup is recomputed (`useMemo`) and the controls are rebuilt from the floor centre.

### Positive Consequences

* Every limit scales with the kitchen: a 2 m and a 40 m kitchen are both framed and bounded.
* The calculations run in Node without a browser: the obstacle check is already covered by `visualization3d-scene.test.js`, and `computeCameraSetup` and `constrainPan` can be tested the same way.
* Full control over the `change` event, the reset and the clean-up, with the official Three.js implementation.
* The drei `OrbitControls` is no longer used, so the controls follow the Three.js version installed.

### Negative Consequences

* More code than drei props: one component and one module.
* The pan limit and the obstacle check run on every camera change; the obstacle boxes are recomputed at most every 500 ms to keep this cheap.
* The obstacles are axis-aligned bounding boxes, larger than rotated or round models, so the camera stops a little before some of them.
* The camera cannot reach a grazing view of the floor (limited to 65° from the vertical).

## Pros and Cons of the Options

### Keep the drei `OrbitControls`

* Good, because it is already in the scene and needs only props.
* Bad, because drei wraps the `three-stdlib` port, not the Three.js implementation, and the pan limit and the reset need direct access to the controls instance anyway.
* Bad, because the limits would still have to be computed somewhere outside the JSX.

### Three.js `OrbitControls` in a component of our own

* Good, because it is the implementation recommended by Three.js, with dolly, polar, azimuth and damping built in.
* Good, because the limits are computed by pure, tested functions.
* Bad, because the instance is created imperatively in a `useEffect`, outside the React tree.

### Custom camera controller

* Good, because every movement could be tailored.
* Bad, because pointer handling, spherical coordinates, damping and touch support would have to be written and tested from scratch.

## Links

* [ADR-0039](./0039-adoption-of-r3f-for-3d-module-integration.md) - Adoption of R3F for 3D module integration
* [ADR-0032](./0032-viewer-reload-mechanism-in-the-frontend.md) - Viewer reload mechanism: state-based React key reset
* [Three.js OrbitControls documentation](https://threejs.org/docs/#examples/en/controls/OrbitControls)
