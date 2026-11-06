# Viewer Reload Mechanism in the Frontend

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

When the active configuration changes, the embedded 3D viewer must reflect the new layout without a full page refresh.

## Decision Drivers

* React architecture constraints.
* User experience.

## Considered Options

* Polling the backend from the viewer
* State-based React key reset

## Decision Outcome

Chosen option: "State-based React key reset", because it is the most predictable way to ensure the Three.js/WebGL context is completely cleared and rebuilt with the new configuration, preventing memory leaks or leftover meshes.

### Positive Consequences

* Clean and predictable 3D scene initialization.

### Negative Consequences

* A brief loading flicker during remount.

## Pros and Cons of the Options

### Polling the backend from the viewer

* Good, because the viewer is autonomous
* Bad, because it creates unnecessary network traffic

### State-based React key reset

* Good, because the backend API remains strictly JSON, utilizing the standard `POST /` endpoint
* Bad, because very large JSON files could cause browser memory issues (unlikely for kitchen layouts)
