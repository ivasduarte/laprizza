# Assembly Line Configuration Referenced by the Kitchen Configuration

- Status: accepted
- Deciders: Development Team
- Date: 2026-11-13

Technical Story: [VIS03] Automated Pizza Assembly Line (related: [WEB06] Kitchen Configuration)

## Context and Problem Statement

VIS03 requires an automated pizza assembly line "on one kitchen wall", animated in Sprint 3. WEB06 states that the kitchen configuration "must include ... the placement, orientation, and scale of equipment and assembly-line elements", that exactly one configuration is active, and that the JSON may provide what the VIS User Stories need "either directly or through resolvable back-end references".

The first implementation stored assembly line configurations as an independent aggregate with its own `isActive` flag and atomic activation. This allowed two independently active configurations (kitchen and line) to become inconsistent: nothing tied the active line to the active kitchen, nor defined where in the kitchen the line stands. It is necessary to determine how the assembly line configuration should relate to the kitchen configuration.

## Decision Drivers

- Compliance with WEB06: exactly one valid configuration must be active, without ambiguity
- Consistency between the kitchen and the assembly line shown in the 3D viewer
- Reusability of a line definition across different kitchen layouts
- Freedom to evolve the line's internal model (VIS03 components, Sprint 3 animation data) without inflating the kitchen schema
- The 3D viewer must never receive a dangling reference
- Existing kitchen configurations must remain valid

## Considered Options

- Independent assembly line aggregate with its own active state (first implementation)
- Assembly line embedded directly in the kitchen configuration
- Assembly line library referenced by the kitchen configuration

## Decision Outcome

Chosen option: "Assembly line library referenced by the kitchen configuration", because it makes the active kitchen configuration the single source of truth for what the 3D viewer shows, while keeping line definitions reusable and decoupled from the kitchen schema. This matches the WEB06 allowance for "resolvable back-end references".

- An **Assembly Line Configuration** is a library of line definitions: footprint (`dimensions`) and elements in the line's own local coordinate system. It has **no active state**: no `isActive`, no `/active` and no `/{id}/activate` endpoints.
- A **Kitchen Configuration** places a line through `content.assemblyLine` (`configurationId`, `position`, `rotation`).
- A line referenced by any kitchen configuration cannot be deleted (409).
- Line content changes are fully validated before being saved.
- `content.assemblyLine` is optional for now so that existing kitchen configurations stay valid.

### Positive Consequences

- Satisfies "exactly one valid configuration must be active" without ambiguity, since only the kitchen configuration has an active state
- Keeps the line definition reusable across kitchen layouts
- The line's internal model evolves without inflating the kitchen schema
- Removes the possibility of an active line that is unrelated to the active kitchen

### Negative Consequences

- The kitchen service must check that `configurationId` resolves to an existing line
- `GET /kitchen-configurations/active` should return the resolved line so the viewer never receives a dangling reference (pending)
- Deleting a line becomes restricted while any kitchen configuration references it (409)

## Pros and Cons of the Options

### Independent assembly line aggregate with its own active state

The first implementation: assembly line configurations as a separate aggregate with `isActive` and atomic activation.

- Good, because each aggregate is simple and self-contained
- Good, because it is already implemented
- Bad, because two independently active configurations (kitchen and line) can be inconsistent
- Bad, because nothing defines where in the kitchen the active line stands

### Assembly line embedded directly in the kitchen configuration

The line's footprint and elements are stored inside `content` of the kitchen configuration.

- Good, because the kitchen configuration is a single self-contained document with no references to resolve
- Bad, because the line definition cannot be reused across kitchen layouts
- Bad, because the kitchen schema grows with every evolution of the line's internal model (VIS03 components, Sprint 3 animation data)

### Assembly line library referenced by the kitchen configuration

Line definitions live in their own library, and the kitchen configuration places one through `content.assemblyLine` (`configurationId`, `position`, `rotation`).

- Good, because the active kitchen configuration is the single source of truth for the 3D viewer
- Good, because line definitions are reusable and evolve independently of the kitchen schema
- Good, because placement and orientation are explicitly defined by the kitchen, as WEB06 requires
- Bad, because it requires reference validation in the kitchen service and a resolved response on the active endpoint
- Bad, because it adds a deletion constraint (409) on referenced lines
