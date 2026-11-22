# Adoption of R3F for 3D Module Integration

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-09

Technical Story: [VIS01] 3D Module Integration

## Context and Problem Statement

The current LaPrizza application is a React-based Single-Page Application (SPA). The accepance criteria require that the 3D engine (WebGL or Three.js) be embedded as a component within the SPA, preserving existing routes, layout, and authentication flow. It is necessary to determine the most appropriate technological approach for rendering 3D graphics within the React ecosystem and lifecycle.

## Decision Drivers

* Compatibility with existing React architecture (virtual DOM)
* Guaranteed uninterrupted UI, navigation, and current security/authentication
* Ease of integration into the designated interface file (`kitchen-viewer.jsx`)
* Automatic lifecycle management (native WebGL memory cleanup when changing pages in the SPA)

## Considered Options

* Native WebGL
* Vanilla Three.js
* Three.js with React Three Fiber (R3F)

## Decision Outcome

Chosen option: "Three.js with React Three Fiber", because it perfectly satisfies the acceptance criteria of embedding the 3D engine as a component within the SPA's routing and layout. By treating the 3D objects as React components, it integrates frictionlessly into the existing `features/visualization3d` route without interfering with the session management or DOM structure

### Positive Consequences

* Maintains the integrity of the existing SPA (UI, routing, and authentication remain untouched)
* Significantly accelerates development speed by eliminating manual DOM menipulation and memory cleanup boilerplate
* Leverages the team's existing React knowledge while providing full access to Three.js capabilities

### Negative Consequences

* Adds a slight learning curve for debugging, as errors might stem from the R3F wrapper rather than the underlying Three.js engine itself

## Pros and Cons of the Options

### Native WebGL

Direct use of the low-level WebGL API.

* Good, because it guarantees absolute control over the graphics pipeline and maximum performance, without external dependencies on 3D engines
* Bad, because it requires a huge amount of complex code (shaders, mathematical matrices) to draw simple primitives, making it incompatible with rapid sprint delivery

### Vanilla Three.js

Standard and mandatory use of the Three.js library.

* Good, because it's a high-level 3D library perfectly capable of importing models and textures with ease
* Bad, because it requires direct DOM manipulation (e.g., imperatively adding the element), which conflicts with React's declarative paradigm.
* Bad, because manually cleaning up graphical resources when switching routes is prone to crashes and memory leaks `<canvas>`

### Three.js with React Three Fiber

Using a wrapper (`@react-three/fiber`) that allows writing Three.js scenarios as declarative React components.

* Good, because it integrates with the SPA component tree
* Good, because The canvas and camera react to the React state, and WebGL memory is automatically cleared when the component is unmounted by the router
* Bad, because it introduces additional dependencies in `package.json` (`@react-three/fiber`), and forces the team to learn wrapper's specific syntax instead of just consulting the official Three.js documentation (`@react-three/drei`)

## Links

* [React Three Fiber Official Documentation](https://r3f.docs.pmnd.rs/getting-started/introduction)
* [Three.js Official Documentation](https://threejs.org)
