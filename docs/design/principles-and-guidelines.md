# Principles and Guidelines

The principles constrain how the architecture is designed; the guidelines describe how the team works.

## Principles

| Principle                                                                                                    | Consequence For The Architecture                                                                                                          |
| :--------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| Business rules independent of presentation, persistence and infrastructure (ARC02)                               | Dependencies point towards the domain. <br> The domain depends on no framework, database or HTTP concept.                                     |
| Responsibilities and concerns appropriately separated (ARC02)                                                    | The back-end is divided in layers with explicit responsibilities and allowed dependencies (see 2.2.1).                                        |
| Domain concepts distinguished from implementation, persistence, presentation and infrastructure concerns (ARC01) | The domain model is documented independently from the persistence model.                                                                      |
| Mock-based unit tests with `node:test`                                                                           | Collaborators of domain and application code are accessed through interfaces and replaced in unit tests with the native Node.js mocks (`node:test` and `node:assert`, `t.mock.method`), with no external mocking library ([ADR-0028](../adr/0028-mock-based-unit-testing.md)). |
| Few components (fewer than 10) with stable, versioned interfaces understood by all team members                  | New functionality is added inside existing components whenever possible.                                                                      |
| Documentation complements the code, follows DDD and keeps diagrams as text                                       | Diagrams are kept as text in the repository: Mermaid for the architecture views (`views.md`), PlantUML for the other documentation.          |

## Guidelines

| Area          | Guideline                                                                                                                                                    | Documented In                                                  |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| Branching         | Simplified Git Flow: <br> `main` holds stable code; <br> Short-lived branches (deleted after merge): `feature/<US-ID>-<description>`, `fix/...` and `docs/...`   | README, Branch Strategy                                            |
| Branch protection | No direct pushes to `main`; <br> At least one approving review; <br> Build and tests must pass; <br> Branch up to date before merging.                           | README, Branch Protection                                          |
| Pull requests     | One per User Story; <br> Conventional Commits title; <br> Description links the issue and states how it was tested; <br> Reviewed by the designated peer tester. | README, Pull Requests, [ADR-0006](../adr/0006-continuous-integration-pipeline.md) |
| Commits           | Conventional Commits; <br> Scope is the US ID or the module.                                                                                                     | README, Conventional Commits                                       |
| Testing           | Unit tests use the native `node:test` mocks and no external mocking library; <br> Coverage of at least 90% in domain and controller code; <br> Tests cover business rules and invariants; <br> Frontend flows are covered by Playwright E2E tests ([ADR-0029](../adr/0029-frontend-end-to-end-%28e2e%29-testing-framework.md)). | README, Definition of Done                                         |
| Documentation     | Architecture views in `/docs` as Mermaid diagrams (`views.md`); domain models as PlantUML diagrams                                                                                                  | README, Definition of Done                                         |
| API               | Routes under `/api/v1`; <br> A single JSON error format; <br> OpenAPI documentation served with `Swagger UI`.                                                    | README, Run                                                        |
| Configuration     | Configuration in `.env` (never committed), with `.env.example` as reference; <br> `Node.js` >= 22.13.0 and `npm`                                                 | README, Setup                                                      |

## Consistency With The Implementation

### How consistency is kept

| Mechanism         | Description                                                                                                                                | Status |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| Definition of Done    | Documentation in `/docs` is updated in the same pull request that changes modules, dependencies, API or decisions (README, Definition of Done) | In use     |
| Pull Request Review   | The reviewer checks that the SAD matches the change before approving                                                                           | In use     |
| API Contract          | The OpenAPI description is the contract of the API and is updated before the endpoints change ([ADR-0005](../adr/0005-contract-first-rest-api.md))   | In use     |
| Pre-Submission Review | Before the tag `sprint-N-submission` is created, the team goes through the checklist below                                                     | In use     |

### Pre-submission checklist

- Module names and elements in the Level 3 Development View match the folders and files in `backend/src`.
- Dependencies between modules follow the "May Use" column of Module Dependencies in the Level 3 Development View.
- Dependencies between containers follow the "May Use" column of the Level 2 Development View.
- Element names and types are the same in every view of the same level.
- Every route in the OpenAPI description exists, and the other way around.
- Containers and technologies in the Level 2 Logical and Physical Views match what is actually used.
- ADR statuses in section 5 are current and linked from the views that they affect.
- The Mermaid diagrams in `views.md` render without errors, and the `.svg` files of the PlantUML diagrams are regenerated from their `.puml` sources and committed.
- Status labels (Sprint 1 / planned) in the catalogs are true for this submission.

## System Identifiers (IDs)

Following client validation, the system does not enforce a specific business prefix format (e.g., USR-123). Identifiers must be unique, immutable, and auto-generated.

**Decision:** The team adopted MongoDB's native `ObjectId` (24-character hexadecimal strings) as the universal identifier format across all entities in the system.