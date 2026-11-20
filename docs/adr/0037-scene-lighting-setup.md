# Scene Lighting Setup

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-17

Technical Story: [VIS05] Scene Lighting

## Context and Problem Statement

The 3D kitchen must be visible, realistic and easy to read under different viewing conditions. VIS05 requires at least an ambient light and one spotlight, depth and contours without overexposure or excessive darkness, shadows without significant performance degradation, and the same result at every zoom level and camera angle. We must decide which lights to use, where to place them and which of them cast shadows.

## Decision Drivers

* Visibility of every object from any angle.
* Depth and contours (shadows) at a low rendering cost.
* Independence from the camera.
* Lights that can later be switched off and tuned (VIS06) without rebuilding the scene.

## Considered Options

* Ambient light and one shadow-casting spotlight
* Lights attached to the camera
* Five lights at fixed world-space positions derived from the room, two of them casting shadows

## Decision Outcome

Chosen option: "Five lights at fixed world-space positions derived from the room, two of them casting shadows".

* Ambient (0.35) and hemisphere (0.45, dark ground colour) lights give base visibility from any angle.
* A directional light (1.1) above a corner of the room casts shadows with a 2048 × 2048 map and an orthographic frustum fitted to the room.
* A spotlight above the kitchen (3, 60°, penumbra 0.6) casts shadows with a 1024 × 1024 map.
* A spotlight above the assembly line (2, 60°, penumbra 0.7) has no shadows.
* Positions are computed from the kitchen dimensions and the assembly line placement. The values live in `DEFAULT_LIGHTING`.
* Meshes are marked to cast and receive shadows by `ShadowGroup`, once per mesh, checked every 30 frames. The canvas pixel ratio is capped at 2.
* A light that is turned off stays in the scene with intensity 0, so the shaders are not recompiled.

### Positive Consequences

* The lighting is the same from every viewpoint, and the orbit limits keep the camera above the floor.
* Only two shadow maps are rendered.
* Models added later get shadows without changes.

### Negative Consequences

* The positions are not configurable from the kitchen JSON.
* There is no frame rate measurement to support the performance claim.

## Pros and Cons of the Options

### Ambient light and one spotlight

* Good, because it is the minimum the user story asks for.
* Bad, because faces outside the spotlight cone are flat or dark and there is little depth.

### Lights attached to the camera

* Good, because what the camera sees is always lit.
* Bad, because the shadows and highlights move with the camera, so the scene looks different at every angle.

### Fixed world-space lights, two shadow casters

* Good, because it combines base visibility, depth and a stable look at a controlled cost.
* Bad, because large rooms spread the same shadow map resolution over a larger area.
