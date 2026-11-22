# Asset References Strategy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

The 3D viewer requires models and textures. We need to decide how these assets are referenced within the kitchen configuration.

## Decision Drivers

* Performance of the 3D viewer loading assets.
* Complexity of the backend database relationships.

## Considered Options

* References to a backend asset catalogue (Relational)
* Self-contained URL/URI references in the JSON

## Decision Outcome

Chosen option: "Self-contained URL/URI references in the JSON", because optimizing the 3D viewer's load time and decoupling it from backend relational complexity is a higher priority.

### Positive Consequences

* Fast retrieval and simplified backend logic

### Negative Consequences

* Asset URLs are duplicated across configurations

## Pros and Cons of the Options

### References to a backend asset catalogue

* Good, because it centralizes asset management and allows updating a texture across all configurations
* Bad, because it requires complex joins/populates when fetching a configuration, slowing down the 3D viewer initialization

### Self-contained URL/URI references in the JSON

* Good, because the configuration payload is entirely self-sufficient, allowing the 3D viewer to fetch assets directly without secondary backend requests
* Bad, because if an asset URL changes, configurations must be manually updated.
