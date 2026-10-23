# Architecture

## Purpose and Scope

This document contains the description of the system architecture of LaPrizza. <br>
This system follows a **modular**, **web-based architecture** to support the operations of a pizza restaurant. <br> It identifies the principal applications and modules (back-end, web application, 3d visualization, AI scheduling and infrastructure), their responsibilities and interactions.

## Stakeholders and Concerns

| **Stakeholder** | **Concerns to Address** |
|:------------|:--------------------|
| **New Developers** | Principles and rules? <br> History of decisions? <br> Which components exist and how are they connected? |
| **Developers** | Impact of a change? <br> Which components exist and how are they connected? |
| **Infrastructure** | What must be installed, how and where?
| **Testers** | Which modules and interfaces must be tested and what do they depend on? <br> How do the components integrate (API contracts)? <br> How are the tests run? |
| **Client** | Which components exist at run-time and how are they connected? |

## Stakeholders' Documentation Needs

| **Stakeholder** | **Level 1 Logical View** | **Level 2 Development View** | **Level 2 Logical View** | **Level 3 Development View** | **Level 3 Physical View** |
|:-----------:|:----------:|:----:|:-------------:|:---:|:----------:|
| New Developers | x | x | x | x | x |
| Developers | d | d | d | d | d |
| Infrastructure | - | - | - | - | d |
| Testers | - | d | d | - | o |
| Client | - | - | o | - | o |

`d = detailed information, s = some details, o = overview, x = anything`

## Views In This Document

| **View** | **Question It Answers** | **Notation** | **Section** |
|:----|:-------------------|:--------|:-------|
| Level 1 Logical View | What does the system do? | C4 System Context | [Level 1 Logical View](../analysis/context.md#2-functional-view) |
| Level 2 Logical View | Which run-time components exist and how do they communicate? | C4 Container | [Level 2 Logical View](./views.md#level-2-logical-view) |
| Level 2 Development View | Which module may use which? | UML package | [Level 2 Development View](./views.md#level-2-development-view) |
| Level 3 Development View | How is the code decomposed into modules? | UML package | [Level 3 Development View](./views.md#level-3-development-view) |
| Level 3 Physical View | Where do the components run? | C4 Deployment | [Level 3 Physical View](./views.md#level-3-physical-view) |


## Diagram Conventions

- **C4** diagrams for views.
- **PlantUML** for user story documentation.

All diagrams are versioned in the repository. One abstraction level per diagram. Every diagram has title, type, scope and legend when needed. Every element has name, type, description and technology when relevant. Every arrow is labelled with a verb, correct direction and protocol when relevant.


## Architectural Approaches

- **Modular system with few components** (fewer than 10) and stable, versioned interfaces understood by all team members. Components cooperate through REST APIs.
- **Back-end as a layered architecture following Domain-Driven Design.** The dependency rule points inwards: the presentation and infrastructure layers depend on the domain layer, and the domain depends on nothing.

| **Layer** | **Responsibility** | **May Depend On** |
|:-----|:--------------|:-------------|
| Domain | Entities, value objects, aggregates, domain services, business rules and invariants, and the repository interfaces | Nothing |
| Application | Use cases that orchestrate the domain, input and output models (DTOs), queries for the catalogue | Domain |
| Infrastructure | Repository implementations, persistence mapping, migrations and seed data, configuration | Domain |
| Presentation (REST API) | Routes and controllers, request validation, mapping of errors to HTTP status codes, OpenAPI contract | Application |

The exact packages and folders are described in the **Level 3 Development View**.
- **Business data as configuration.** Component types, sizes, categories and allergens are data, not code (BCK06, BCK07).
- **Contract first for the API.** The OpenAPI description is the contract between the back-end and its future clients.
- **Whole system documented, Sprint 1 implemented.** Components of later sprints are documented but not built, as required by ARC01 and ARC02.
- **Walking skeleton.** A minimal end-to-end slice implemented early in Sprint 1: the Express application with the `GET /api/v1/health` endpoint and the OpenAPI description, followed by the first vertical slice, user and authentication management (BCK01), through all layers.


## Platforms

Software and hardware platforms on which the system is built and deployed.

| **Platform / Technology** | **Used For** | **Decided In** |
|:---|:---|:---|
| `GitHub` | Version control, issue tracking, project board | ENG01 (Sprint 1 user stories) |
| `Node.js (JavaScript)` | Back-end | [ADR-0001](./decisions/0001-backend-platform.md) |
| `Express` | HTTP framework of the back-end REST API | [ADR-0001](./decisions/0001-backend-platform.md) |
| `npm` | Package management | [ADR-0001](./decisions/0001-backend-platform.md) |
| `OpenAPI` | Machine-readable API contract | [ADR-0005](./decisions/0005_api_contract.md) |
| `Database MongoDB` | Persistence of the business information | [ADR-0003](./decisions/0003-persistence-seed.md) |
| `WebGL` and `Three.js` | 3D Visualization (SGRAI, Sprint 2 onwards) | Imposed by the System Specification (II.3.3) |
| `Prolog` | AI planning and scheduling (IART, Sprint 2 onwards) | Imposed by the System Specification (II.3.4) |
| `PlantUML` | Diagrams as text in the repository | Team documentation convention |
| Web Application Technology [TBD] | User Interface | To be decided |
| Hardware, Containerization, Reverse Proxy [TBD] | Deployment and operation (ASIST, Sprint 2 onwards) | To be decided |