# Rules for Editing and Deleting the Active Configuration

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

The active configuration is actively consumed by the 3D viewer. We must define what happens when a manager tries to edit or delete it.

## Decision Drivers

* Prevent system downtime or viewer crashes.
* Flexibility for the manager.

## Considered Options

* Block all edits and deletions on the active configuration
* Reject deletion, but allow edits with re-validation

## Decision Outcome

Chosen option: "Reject deletion, but allow edits with re-validation", because it provides the best balance between system stability (preventing null states) and operational agility.

### Positive Consequences

* The 3D viewer is guaranteed to always have a configuration available.

### Negative Consequences

* The frontend must handle viewer reloads gracefully when the active configuration is edited.

## Pros and Cons of the Options

### Block all edits and deletions on the active configuration

* Good, because it guarantees absolute stability for the viewer
* Bad, because a manager must duplicate, edit, and swap just to fix a typo

### Reject deletion, but allow edits with re-validation

* Good, because it prevents the system from having zero active configurations, but allows seamless updates if the new payload passes all validations
* Bad, because an edit might momentarily break a connected viewer if it doesn't reload.
