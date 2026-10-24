# Principles and Guidelines

The principles constrain how the architecture is designed; the guidelines describe how the team works.

## Principles
 
| **Principle** | **Consequence For The Architecture** |
|:----------|:---------------------------------|
| Business rules independent of presentation, persistence and infrastructure (ARC02) | Dependencies point towards the domain. <br> The domain depends on no framework, database or HTTP concept. |
| Responsibilities and concerns appropriately separated (ARC02) | The back-end is divided in layers with explicit responsibilities and allowed dependencies (see 2.2.1). |
| Domain concepts distinguished from implementation, persistence, presentation and infrastructure concerns (ARC01) | The domain model is documented independently from the persistence model. |
| Tests without mocking libraries (Dummy approach) | Collaborators of domain and application classes are accessed through interfaces, so that hand-written dummies can replace them in unit tests. |
| Few components (fewer than 10) with stable, versioned interfaces understood by all team members | New functionality is added inside existing components whenever possible. |
| Documentation complements the code, follows DDD and uses PlantUML for diagrams | Diagrams are kept as PlantUML text in the repository. |


## Guidelines


| **Area** | **Guideline** | **Documented In** |
|:----|:---------|:-------------|
| Branching | Simplified Git Flow: <br> `main` holds stable code; <br> Short-lived branches (deleted after merge): `feature/<US-ID>-<description>`, `fix/...` and `docs/...` | README, Branch Strategy |
| Branch protection | No direct pushes to `main`; <br> At least one approving review; <br> Build and tests must pass; <br> Branch up to date before merging. | README, Branch Protection |
| Pull requests | One per User Story; <br> Conventional Commits title; <br> Description links the issue and states how it was tested; <br> Reviewed by the designated peer tester. | README, Pull Requests, [ADR-0006](./decisions/0006-ci-pipeline.md) |
| Commits | Conventional Commits; <br> Scope is the US ID or the module. | README, Conventional Commits |
| Testing | Unit tests use dummies and no mocking libraries; <br> Coverage of at least 90% in domain and controller code; <br> Tests cover business rules and invariants. | README, Definition of Done |
| Documentation | Architecture and domain models in `/docs`, as PlantUML diagrams | README, Definition of Done |
| API | Routes under `/api/v1`; <br> A single JSON error format; <br> OpenAPI documentation served with `Swagger UI`. | README, Run |
| Configuration | Configuration in `.env` (never committed), with `.env.example` as reference; <br> `Node.js` >= 22.13.0 and `npm` | README, Setup |


## Consistency With The Implementation

### How consistency is kept

| **Mechanism** | **Description** | **Status** |
|:---------|:-----------|:------|
| Definition of Done | Documentation in `/docs` is updated in the same pull request that changes modules, dependencies, API or decisions (README, Definition of Done) | In use |
| Pull Request Review | The reviewer checks that the SAD matches the change before approving | In use |
| API Contract | The OpenAPI description is the contract of the API and is updated before the endpoints change ([ADR-0005](./decisions/0005-api-contract.md)) | In use |
| Pre-Submission Review | Before the tag `sprint-N-submission` is created, the team goes through the checklist below | In use |

### Pre-submission checklist

- Module names and elements in 3.2 and 3.3 match the folders and files in `backend/src`.
- Dependencies between modules follow the "May use" column of 3.2.
- Every route in the OpenAPI description exists, and the other way around.
- Containers and technologies in 3.4 match what is actually used.
- ADR statuses in section 5 are current and linked from the views that they affect.
- Diagrams are regenerated from their `.puml` sources, and the `.svg` files are committed.
- Status labels (Sprint 1 / planned) in the catalogs are true for this submission.