## 1. Architectural Decisions

A decision is architecturally significant when its cost of change is high. One ADR per decision in `docs/System Architecture/decisions`; this table is only the index.

| ADR | Decision | Status | Affects |
|:---:|:--------:|:------:|:-------:|
| [0001](decisions/0001-backend-platform.md) | Back-End Platform and Technology Stack | Accepted | C&C; Module views; Platforms |
| [0002](decisions/0002-layered-ddd.md) | Layered Domain-Driven Design (DDD) Architecture | Accepted | Module views; Principles and guidelines |
| [0003](decisions/0003-persistence-seed.md) | Persistence and Seed Data Mechanism | Accepted | C&C; Module views; Platforms |
| [0004](decisions/0004-auth.md) | Authentication and Authorization | Accepted | Functional view; C&C; Module views |
| [0005](decisions/0005-api-contract.md) | Contract-First REST API | Accepted | C&C; Module views; Principles and guidelines |

---

## 2. Analysis results

No formal analysis of the architecture (scenario walk-through, risk review) has been done yet. This section is completed when it is. The analyses planned are:
 
| Analysis | What is checked | Status |
|:--------:|:---------------:|:------:|
| Walk-through of the key scenarios across the layers | Each scenario can be realised without a layer depending on one that is not allowed | Pending |
| Review of the module uses view against the dependency rule | No dependency from the domain to outer layers | Pending |
| Review of the API contract against the future clients (Web Application, 3D, AI) | The API provides what the Sprint 2 and 3 scenarios need | Pending |
 
Risks identified from the specification:
 
| Risk | Mitigation |
|:----:|:----------:|
| Cross-concept invariants (BCK10) leak into controllers or persistence code | Keep them in the domain and cover valid and invalid scenarios with automated tests |
| Over-modelling, because the domain analysis is wider than the Sprint 1 implementation | Document the full model, implement only the Back-End user stories |
| Component types hard-coded in the source | Configurable data and seed data |
| Inconsistent stock under concurrent updates | Decide the strategy together with the persistence approach |
| Late integration with Sprint 2 components because the API changes | Define and version the OpenAPI contract early |

---

## 3. Requirements coverage

Justification of how the architecture satisfies the drivers.

| Driver | Addressed by (view / ADR) |
|:---:|:---:|
| Users, roles and authentication (BCK01) | [Module decomposition view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleDecomposition.svg); [ADR-0004](/docs/System%20Architecture/decisions/0004-auth.md) |
| Single Product concept with several characteristics (BCK05) | [Module decomposition view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleDecomposition.svg); ARC01 domain model |
| Business data as configuration (BCK03, BCK04, BCK06, BCK07) | [Module decomposition view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleDecomposition.svg); [ADR-0003](/docs/System%20Architecture/decisions/0003-persistence-seed.md) |
| Invariants across several concepts (BCK08, BCK09, BCK10) | [Module uses (layers) view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleUses.svg); [ADR-0002](/docs/System%20Architecture/decisions/0002-layered-ddd.md) |
| REST API with a machine-readable contract (ARC03) | [C&C view](/docs/System%20Architecture/architectural_diagrams/svg/ContainerView.svg); [ADR-0005](/docs/System%20Architecture/decisions/0005-api-contract.md) |
| Business rules independent of presentation, persistence and infrastructure (ARC02) | [Module uses (layers) view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleUses.svg); [ADR-0002](/docs/System%20Architecture/decisions/0002-layered-ddd.md) |
| Testability without mocking libraries (ARC05) | [Module uses (layers) view](/docs/System%20Architecture/architectural_diagrams/svg/ModuleUses.svg); [ADR-0002](/docs/System%20Architecture/decisions/0002-layered-ddd.md) |
| Reproducible persistence and data integrity (ARC04) | [ADR-0003](/docs/System%20Architecture/decisions/0003-persistence-seed.md) |
| Progressive integration of Web Application, 3D, AI and infrastructure | [Functional view](/docs/System%20Architecture/architectural_diagrams/svg/SystemContext.svg); [C&C view](/docs/System%20Architecture/architectural_diagrams/svg/ContainerView.svg); [Deployment view](/docs/System%20Architecture/architectural_diagrams/svg/DeploymentView.svg) |
| GDPR and security | [ADR-0004](/docs/System%20Architecture/decisions/0004-auth.md) |
| Sprint 1 limited to the back-end, architecture for the whole system | [Functional view](/docs/System%20Architecture/architectural_diagrams/svg/SystemContext.svg); [C&C view](/docs/System%20Architecture/architectural_diagrams/svg/ContainerView.svg) |