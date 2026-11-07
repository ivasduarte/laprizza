# Rationale

A decision is architecturally significant when its cost of change is high. One ADR per decision in `docs/System Architecture/adr`. <br> This table is only the index.

| ADR | Decision | Status | Affects |
|:---|:--------|:------|:-------|
| [0000](./adr/0000-use-architecture-decision-records-%28adrs%29.md) | Use Architecture Decision Records (ADRs) | Accepted | Rationale |
| [0001](./adr/0001-back-end-platform-and-technology-stack.md) | Back-End Platform and Technology Stack | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Platforms |
| [0002](./adr/0002-layered-domain-driven-design-%28ddd%29-architecture.md) | Layered Domain-Driven Design (DDD) Architecture | Accepted | Level 3 Development View; <br> Principles and Guidelines |
| [0003](./adr/0003-persistence-and-seed-data-mechanism.md) | Persistence and Seed Data Mechanism | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Platforms |
| [0004](./adr/0004-authentication-and-authorization.md) | Authentication and Authorization | Accepted | Level 1 Logical View; <br> Level 2 Logical View; <br> Level 3 Development View |
| [0005](./adr/0005-contract-first-rest-api.md) | Contract-First REST API | Accepted | Level 2 Logical View; <br> Levels 2 and 3 Development Views; <br> Principles and guidelines |
| [0006](./adr/0006-continuous-integration-pipeline.md) | CI Automation | Accepted | Level 2 and 3 Development Views; <br> Principles and Guidelines |
| [0007](./adr/0007-web-application-%28spa%29-technology-and-structure.md) | Web Application (SPA) Technology and Structure | Accepted | Level 2 Logical View; <br> Level 2 Physical View; <br> Platforms |
| [0008](./adr/0008-implement-rate-limiting-policies.md) | Rate Limiting Policies | Accepted | Level 3 Logical View |
| [0009](./adr/0009-generate-dynamic-http-client-with-orval.md) | Dynamic HTTP Client Generation with Orval | Accepted | Level 2 Logical View; <br> Platforms |
| [0010](./adr/0010-isolate-database-versioning-with-migrations.md) | Database Versioning Isolated with Migrations | Accepted | Level 3 Development View |
| [0011](./adr/0011-implement-refresh-tokens-for-secure-sessions.md) | Refresh Tokens for Secure Sessions | Accepted | Level 3 Logical View; <br> Non-Functional View |
| [0012](./adr/0012-schedule-e2e-tests-in-nightly-builds.md) | E2E Tests Scheduled in Nightly Builds | Accepted | Principles and Guidelines |
| [0013](./adr/0013-use-testcontainers-for-automated-integration-testing.md) | Testcontainers for Automated Integration Testing | Accepted | Principles and Guidelines |
| [0014](./adr/0014-api-uri-routing-versioning-strategy.md) | API URI Routing and Versioning Strategy | Accepted | Level 2 Logical View; <br> Level 3 Development View |
| [0015](./adr/0015-introduce-redis-for-caching.md) | Redis for Caching | Accepted | Level 2 Logical View; <br> Level 2 Physical View |
| [0016](./adr/0016-implement-structured-logging-and-monitoring.md) | Structured Logging and Monitoring | Accepted | Level 2 Physical View; <br> Principles and Guidelines |
| [0017](./adr/0017-secrets-management-strategy.md) | Secrets Management Strategy | Accepted | Level 3 Development View; <br> Principles and Guidelines |
| [0018](./adr/0018-internationalization-of-the-web-application-%28english-and-portuguese%29.md) | Internationalization of the Web Application (English and Portuguese) | Accepted | Level 2 Logical View |
| [0019](./adr/0019-migrate-architectural-documentation-from-plantuml-to-mermaid.md) | Migration of the Architectural Documentation from PlantUML to Mermaid | Accepted | Architecture (Diagram Conventions); <br> Principles and Guidelines |
| [0020](../adr/0020-strorage-model-of-kitchen-configurations.md) | Storage Model of Kitchen Configurations | Accepted | Level 3 Logical View; <br> Level 3 Process View; <br> Non-Functional View |
| [0021](../adr/0021-asset-references-strategy.md) | Asset References Strategy | Accepted | Level 1 Logical View; <br> Level 2 Logical View; <br> Level 2 Development View; <br> Level 3 Process View; <br> Non-Functional View |
| [0022](../adr/0022-content-validation-strategy.md) | Content Validation Strategy | Accepted | Level 3 Logical View; <br> Level 3 Process View; <br> Non-Functional View |
| [0023](../adr/0023-atomic-activation-strategy.md) | Atomic Activation Strategy | Accepted | Level 2 Physical View; <br> Level 3 Process View; <br> Non-Functional View |
| [0024](../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md) | Rules for Editing and Deleting the Active Configuration | Accepted | Level 3 Process View; <br> Non-Functional View |
| [0025](../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md) | Active Configuration Endpoint and No-Fallback Policy | Accepted | Level 3 Process View; <br> Non-Functional View |
| [0026](../adr/0026-import-approach.md) | Import Approach | Accepted | Level 3 Process View; <br> Non-Functional View |
| [0027](../adr/0027-viewer-reload-mechanism-in-the-frontend.md) | Viewer Reload Mechanism in the Frontend | Accepted | Level 3 Process View; <br> Non-Functional View |
| [0028](../adr/0028-mock-based-unit-testing.md) | Mock-Based Unit Testing | Accepted | Principles and Guidelines |
| [0029](../adr/0029-frontend-end-to-end-%28e2e%29-testing-framework.md) | Frontend End-to-End (E2E) Testing Framework | Accepted | Principles and Guidelines |


## Analysis Results

No formal analysis of the architecture (scenario walk-through, risk review) has been done yet. This section is completed when it is. 

<br> The analyses planned are:
 
| Analysis | What is checked | Status |
|:--------|:---------------|:------|
| Walk-through of the key scenarios across the layers | Each scenario can be realised without a layer depending on one that is not allowed | Pending |
| Review of the **Level 3 Development View** (Module Dependencies) against the dependency rule | No dependency from the domain to outer layers | Pending |
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
| Users, roles and authentication (BCK01) | [Level 3 Development View](views.md#level-3-development-view) <br> [ADR-0004](./adr/0004-authentication-and-authorization.md) |
| Single Product concept with several characteristics (BCK05) | [Level 3 Development View](views.md#level-3-development-view) <br> [Domain Model](../analysis/diagrams/domain-model.svg) |
| Business data as configuration (BCK03, BCK04, BCK06, BCK07) | [Level 3 Development View](views.md#level-3-development-view) <br> [ADR-0003](./adr/0003-persistence-and-seed-data-mechanism.md) |
| Invariants across several concepts (BCK08, BCK09, BCK10) | [Level 3 Development View](views.md#level-3-development-view) <br> [ADR-0002](./adr/0002-layered-domain-driven-design-%28ddd%29-architecture.md) |
| REST API with a machine-readable contract (ARC03) | [Level 2 Logical View](views.md#level-2-logical-view) <br> [ADR-0005](./adr/0005-contract-first-rest-api.md) |
| Business rules independent of presentation, persistence and infrastructure (ARC02) | [Level 3 Development View](views.md#level-3-development-view) <br> [ADR-0002](./adr/0002-layered-domain-driven-design-%28ddd%29-architecture.md) |
| Testability without mocking libraries (ARC05) | [Level 3 Development View](views.md#level-3-development-view) <br> [ADR-0002](./adr/0002-layered-domain-driven-design-%28ddd%29-architecture.md) |
| Reproducible persistence and data integrity (ARC04) | [ADR-0003](./adr/0003-persistence-and-seed-data-mechanism.md) |
| Progressive integration of Web Application, 3D, AI and infrastructure | [Level 1 Logical View](./diagrams/level-1/logical-view.svg) <br> [Level 2 Logical View](views.md#level-2-logical-view) <br> [Level 2 Physical View](views.md#level-2-physical-view) <br> [Level 2 Development View](views.md#level-2-development-view) |
| GDPR and security | [ADR-0004](./adr/0004-authentication-and-authorization.md) |
| Sprint 1 limited to the back-end, architecture for the whole system | [Level 1 Logical View](views.md#level-1-logical-view) <br> [Level 2 Logical View](views.md#level-2-logical-view) |
| Kitchen configuration and 3D integration page (WEB06) | [Level 3 Logical View](views.md#level-3-logical-view) <br> [Level 3 Process View](views.md#level-3-process-view) <br> [Kitchen Configuration C4 Views](../flows/kitchen-configuration/c4-views.md) <br> [Kitchen Configuration JSON Format](../flows/kitchen-configuration/kitchen-configuration-json-format.md) <br> [ADR-0020](../adr/0020-strorage-model-of-kitchen-configurations.md), [ADR-0021](../adr/0021-asset-references-strategy.md), [ADR-0022](../adr/0022-content-validation-strategy.md), [ADR-0023](../adr/0023-atomic-activation-strategy.md), [ADR-0024](../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md), [ADR-0025](../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md), [ADR-0026](../adr/0026-import-approach.md), [ADR-0027](../adr/0027-viewer-reload-mechanism-in-the-frontend.md) |