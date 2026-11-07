# Architecture

## Purpose and Scope

This document contains the description of the system architecture of LaPrizza. <br>
This system follows a **modular**, **web-based architecture** to support the operations of a pizza restaurant. <br> It identifies the principal applications and modules (back-end, web application, 3d visualization, AI scheduling and infrastructure), their responsibilities and interactions.

## Stakeholders and Concerns

| Stakeholder    | Concerns to Address                                                                                                                                       |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Developers | Principles and rules? <br> History of decisions? <br> Which components exist and how are they connected?                                                  |
| Developers     | Impact of a change? <br> Which components exist and how are they connected?                                                                               |
| Infrastructure | What must be installed, how and where?                                                                                                                    |
| Testers        | Which modules and interfaces must be tested and what do they depend on? <br> How do the components integrate (API contracts)? <br> How are the tests run? |
| Client         | Which components exist at run-time and how are they connected?                                                                                            |

## Stakeholders' Documentation Needs

|  Stakeholder   | Level 1 Logical View | Level 2 Development View | Level 2 Logical View | Level 3 Development View | Level 2 Physical View |
| :------------: | :------------------: | :----------------------: | :------------------: | :----------------------: | :-------------------: |
| New Developers |          x           |            x             |          x           |            x             |           x           |
|   Developers   |          d           |            d             |          d           |            d             |           d           |
| Infrastructure |          -           |            -             |          -           |            -             |           d           |
|    Testers     |          -           |            d             |          d           |            -             |           o           |
|     Client     |          -           |            -             |          o           |            -             |           o           |

`d = detailed information, s = some details, o = overview, x = anything`

## Views In This Document

| View                         | Question It Answers                                                                           | Notation                          | Section                                                                            |
| :--------------------------- | :-------------------------------------------------------------------------------------------- | :-------------------------------- | :--------------------------------------------------------------------------------- |
| Level 1 Logical View         | What does the system do?                                                                      | System context diagram (C4 style) | [Level 1 Logical View](./views.md#level-1-logical-view)                            |
| Level 2 Logical View         | Which run-time containers exist and how do they communicate?                                  | Container diagram (C4 style)      | [Level 2 Logical View](./views.md#level-2-logical-view)                            |
| Level 2 Process View         | How do the containers interact when the AI requirements planning is executed?                 | Sequence diagram                  | [Level 2 Process View](./views.md#level-2-process-view)                            |
| Level 2 Development View     | Which container may use which?                                                                | Container dependency diagram      | [Level 2 Development View](./views.md#level-2-development-view)                    |
| Level 2 Physical View        | Where do the containers run?                                                                  | Deployment diagram (C4 style)     | [Level 2 Physical View](./views.md#level-2-physical-view)                          |
| Level 3 Logical View         | Which components make up the Back-End Application and how do they relate to other containers? | Component diagram (C4 style)      | [Level 3 Logical View](./views.md#level-3-logical-view)                            |
| Level 3 Development View     | How is the code decomposed into modules, and which module may use which?                      | Package diagram                   | [Level 3 Development View](./views.md#level-3-development-view)                    |
| Level 3 Process View         | How do the components of the containers interact in each use case?                            | Sequence diagram (C4 dynamic)     | [Level 3 Process View](./views.md#level-3-process-view)                            |
| Component and Connector View | Which interfaces do the components provide and require?                                       | Component and connector diagram   | [Component and Connector View](./views.md#high-level-component-and-connector-view) |

## Diagram Conventions

- **C4-style** diagrams for the views, written in **Mermaid** in `views.md`. Every box has the same format (name, `[Type: technology]` and description) and the same colours for persons, systems, containers and components. Elements have the same names in every view of a level.
- **PlantUML** for user story documentation.

All diagrams are versioned in the repository. One abstraction level per diagram. Every diagram has a title (the heading of its section), type, scope and legend when needed. Every element has name, type, description and technology when relevant. Every arrow is labelled with a verb, correct direction and protocol when relevant.

## Architectural Approaches

- **Modular system with few components** (fewer than 10) and stable, versioned interfaces understood by all team members. Components cooperate through REST APIs.
- **Back-end as a layered architecture following Domain-Driven Design.** The dependency rule points inwards: the presentation and infrastructure layers depend on the domain layer, and the domain depends on nothing.

| Layer                   | Responsibility                                                                                                     | May Depend On |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------- | :------------ |
| Domain                  | Entities, value objects, aggregates, domain services, business rules and invariants, and the repository interfaces | Nothing       |
| Application             | Use cases that orchestrate the domain, input and output models (DTOs), queries for the catalogue                   | Domain        |
| Infrastructure          | Repository implementations, persistence mapping, migrations and seed data, configuration                           | Domain        |
| Presentation (REST API) | Routes and controllers, request validation, mapping of errors to HTTP status codes, OpenAPI contract               | Application   |

The exact packages and folders, and the dependencies between the layers, are described in the **Level 3 Development View**. The dependencies between the containers are described in the **Level 2 Development View**.

- **Business data as configuration.** Component types, sizes, categories and allergens are data, not code (BCK06, BCK07).
- **Contract first for the API.** The OpenAPI description is the contract between the back-end and its future clients.
- **Whole system documented, Sprint 1 implemented.** Components of later sprints are documented but not built, as required by ARC01 and ARC02.
- **Walking skeleton.** A minimal end-to-end slice implemented early in Sprint 1: the Express application with the `GET /api/v1/health` endpoint and the OpenAPI description, followed by the first vertical slice, user and authentication management (BCK01), through all layers.

## Platforms

Software and hardware platforms on which the system is built and deployed.

| Platform / Technology                           | Used For                                            | Decided In                                                                  |
| :---------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------- |
| `GitHub`                                        | Version control, issue tracking, project board      | ENG01 (Sprint 1 user stories)                                               |
| `Node.js (JavaScript)`                          | Back-end                                            | [ADR-0001](../adr/0001-back-end-platform-and-technology-stack.md)           |
| `Express`                                       | HTTP framework of the back-end REST API             | [ADR-0001](../adr/0001-back-end-platform-and-technology-stack.md)           |
| `npm`                                           | Package management                                  | [ADR-0001](../adr/0001-back-end-platform-and-technology-stack.md)           |
| `OpenAPI`                                       | Machine-readable API contract                       | [ADR-0005](../adr/0005-contract-first-rest-api.md)                          |
| `Database MongoDB`                              | Persistence of the business information             | [ADR-0003](../adr/0003-persistence-and-seed-data-mechanism.md)              |
| `WebGL` and `Three.js`                          | 3D Visualization (SGRAI, Sprint 2 onwards)          | Imposed by the System Specification (II.3.3)                                |
| `Prolog`                                        | AI planning and scheduling (IART, Sprint 2 onwards) | Imposed by the System Specification (II.3.4)                                |
| `PlantUML`                                      | Diagrams as text in the repository                  | Team documentation convention                                               |
| `React`, `Vite` and `React Router`              | Web Application (SPA)                               | [ADR-0007](<../adr/0007-web-application-(spa)-technology-and-structure.md>) |
| Hardware, Containerization, Reverse Proxy [TBD] | Deployment and operation (ASIST, Sprint 2 onwards)  | To be decided                                                               |
