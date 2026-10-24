# Rationale

A decision is architecturally significant when its cost of change is high. One ADR per decision in `docs/System Architecture/decisions`. <br> This table is only the index.

| ADR | Decision | Status | Affects |
|:---|:--------|:------|:-------|
| [0001](./decisions/0001-backend-platform.md) | Back-End Platform and Technology Stack | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Platforms |
| [0002](./decisions/0002-layered-ddd.md) | Layered Domain-Driven Design (DDD) Architecture | Accepted | Levels 2 and 3 Development Views; <br> Principles and Guidelines |
| [0003](./decisions/0003-persistence-seed.md) | Persistence and Seed Data Mechanism | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Platforms |
| [0004](./decisions/0004-auth.md) | Authentication and Authorization | Accepted | Level 1 Logical View; <br> Level 2 Logical View; <br> Levels 2 and 3 Development Views |
| [0005](./decisions/0005-api-contract.md) | Contract-First REST API | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Principles and guidelines |
| [0006](./decisions/0006-ci-pipeline.md) | CI Automation | Accepted | Level 2 and 3 Development Views; <br> Principles and Guidelines |


## Analysis Results

No formal analysis of the architecture (scenario walk-through, risk review) has been done yet. This section is completed when it is. 

<br> The analyses planned are:
 
| Analysis | What is checked | Status |
|:--------|:---------------|:------|
| Walk-through of the key scenarios across the layers | Each scenario can be realised without a layer depending on one that is not allowed | Pending |
| Review of the **Level 2 Development View** against the dependency rule | No dependency from the domain to outer layers | Pending |
| Review of the API contract against the future clients (Web Application, 3D, AI) | The API provides what the Sprint 2 and 3 scenarios need | Pending |
 

<br> Risks identified from the specification:
 
| Risk | Mitigation |
|:----|:----------|
| Cross-concept invariants (BCK10) leak into controllers or persistence code | Keep them in the domain and cover valid and invalid scenarios with automated tests |
| Over-modelling, because the domain analysis is wider than the Sprint 1 implementation | Document the full model, implement only the Back-End user stories |
| Component types hard-coded in the source | Configurable data and seed data |
| Inconsistent stock under concurrent updates | Decide the strategy together with the persistence approach |
| Late integration with Sprint 2 components because the API changes | Define and version the OpenAPI contract early |


## Requirements Coverage

Justification of how the architecture satisfies the drivers.

| Driver | Addressed By (View / ADR) |
|:---|:---|
| Users, roles and authentication (BCK01) | [Level 3 Development View](./diagrams/level-3/development-view.svg) <br> [ADR-0004](./decisions/0004-auth.md) |
| Single Product concept with several characteristics (BCK05) | [Level 3 Development View](./diagrams/level-3/development-view.svg) <br> [Domain Model](../analysis/diagrams/domain-model.svg) |
| Business data as configuration (BCK03, BCK04, BCK06, BCK07) | [Level 3 Development View](./diagrams/level-3/development-view.svg) <br> [ADR-0003](./decisions/0003-persistence-seed.md) |
| Invariants across several concepts (BCK08, BCK09, BCK10) | [Level 2 Development View](./diagrams/level-2/development-view.svg) <br> [ADR-0002](./decisions/0002-layered-ddd.md) |
| REST API with a machine-readable contract (ARC03) | [Level 2 Logical View](./diagrams/level-2/logical-view.svg) <br> [ADR-0005](./decisions/0005-api-contract.md) |
| Business rules independent of presentation, persistence and infrastructure (ARC02) | [Level 2 Development View](./diagrams/level-2/development-view.svg) <br> [ADR-0002](./decisions/0002-layered-ddd.md) |
| Testability without mocking libraries (ARC05) | [Level 2 Development View](./diagrams/level-2/development-view.svg) <br> [ADR-0002](./decisions/0002-layered-ddd.md) |
| Reproducible persistence and data integrity (ARC04) | [ADR-0003](./decisions/0003-persistence-seed.md) |
| Progressive integration of Web Application, 3D, AI and infrastructure | [Level 1 Logical View](./diagrams/level-1/logical-view.svg) <br> [Level 2 Logical View](./diagrams/level-2/logical-view.svg) <br> [Level 3 Physical View](./diagrams/level-3/physical-view.svg) |
| GDPR and security | [ADR-0004](./decisions/0004-auth.md) |
| Sprint 1 limited to the back-end, architecture for the whole system | [Level 1 Logical View](./diagrams/level-1/logical-view.svg) <br> [Level 2 Logical View](./diagrams/level-2/logical-view.svg) |