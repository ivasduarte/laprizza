# Sprint 1 Retrospective

**Date:** 23-10-2026
<br> **Sprint:** 1

### What Went Well

- **Technical Foundation:** Successfully established the project repository, development environment, and core DDD architecture.
- **API Contracts:** The Contract-First REST API approach using OpenAPI proved effective in aligning the team on endpoints before implementation.
- **Team Adaptability:** Effectively managed unexpected absences and reallocated tasks without compromising the Sprint Goal.

### What Could Be Improved

- **Estimation Accuracy:** Some tasks, particularly around setting up the in-memory dummy repositories for the tests, took longer than initially estimated.
- **Code Reviews:** Pull requests occasionally piled up towards the end of the sprint, creating a minor bottleneck.

### Impediments & Exceptions

- **Workload Reallocation (Illness):** During the sprint, a team member fell ill and was unable to complete their assigned tasks. To ensure the delivery of **BCK11**, the team met, reassessed the remaining workload, and successfully reassigned the implementation and testing tasks among the available members. This guaranteed the sprint commitments were fulfilled.
- **Late Client Clarifications:** Confirmation of the business rules regarding autonomous customer registration (requirement of a dedicated public endpoint and immediate generation of the `Customer` entity) was received very close to the end of the sprint. To ensure release stability and comply with the code freeze, the development and integration of this feature were transitioned to Sprint 2.

### Action Items for Sprint 2

- **Review Process:** Enforce a rule to review Pull Requests within 24 hours of creation to avoid end-of-sprint bottlenecks.
- **Task Breakdown:** Break down testing tasks into smaller, more granular tickets during Sprint Planning to improve estimation accuracy.
- **Customer Self-Registration:** Implement the new public endpoint (e.g., `POST /api/v1/auth/register`) for autonomous customer registration, ensuring the simultaneous creation of the `User` account and the `Customer` entity, as clarified by the client at the end of Sprint 1.
