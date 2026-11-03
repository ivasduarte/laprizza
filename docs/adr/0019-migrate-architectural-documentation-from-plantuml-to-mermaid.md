# Migrate Architectural Documentation from PlantUML to Mermaid

* Status: accepted
* Deciders: Development Team
* Date: 2026-10-31

Technical Story: Streamline the creation and maintenance of the Software Architecture Document (SAD) by adopting a diagramming tool with native Markdown integration and no external dependencies.

## Context and Problem Statement

The project requires extensive SAD documentation, including C4 models and UML diagrams (ARC02). Previously, PlantUML was used. However, PlantUML requires a local Java runtime or external rendering servers, and its syntax for C4 macros can be verbose and prone to strict linter errors. Furthermore, PlantUML diagrams (.puml) do not render natively in GitHub pull requests, forcing the team to manually generate and commit binary .svg files, which clutters the repository and complicates code reviews.

## Decision Drivers

* Native rendering in source control platforms (GitHub), zero external runtime dependencies, syntax simplicity, and native support for C4 Model and SAD notations.

## Considered Options

* PlantUML
* Mermaid
* Draw.io (XML/UI-based)

## Decision Outcome

Chosen option: "Mermaid", because it radically simplifies the maintenance of SAD documentation. Mermaid diagrams are written as plain text code blocks directly inside Markdown files (` ```mermaid `) and render instantly in source control platforms like GitHub and modern IDEs (VS Code).

### Positive Consequences

* Eliminates the need to generate and track binary `.svg` files in Git. Reviewers can see architectural changes visually rendered directly in Pull Requests. It has native support for C4 and standard UML (sequence, class, flowchart), making SAD documentation much easier to write and maintain.

### Negative Consequences

* Mermaid offers slightly less granular control over visual layout (e.g., strict node positioning) compared to PlantUML, relying instead on its automatic layout engine.
