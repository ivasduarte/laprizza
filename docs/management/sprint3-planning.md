# Sprint 3 Planning

- [Sprint 3 Planning](#sprint-3-planning)
  - [Sprint Details](#sprint-details)
  - [Sprint Goal](#sprint-goal)
  - [Expected Outcome](#expected-outcome)
  - [Backlog Items](#backlog-items)
    - [1. Engineering, Documentation \& Cross-Cutting Architecture (ENG \& ARC)](#1-engineering-documentation--cross-cutting-architecture-eng--arc)
    - [2. Back-End Implementation (BCK)](#2-back-end-implementation-bck)
    - [3. Front-End \& Operational Web Workflows (WEB)](#3-front-end--operational-web-workflows-web)
    - [4. Artificial Intelligence \& Planning (AI)](#4-artificial-intelligence--planning-ai)
    - [5. 3D Animated Kitchen \& Visualization (VIS)](#5-3d-animated-kitchen--visualization-vis)
    - [6. Infrastructure, Continuity \& Security (SYS \& AA)](#6-infrastructure-continuity--security-sys--aa)
    - [7. GDPR \& Data Protection (GDP)](#7-gdpr--data-protection-gdp)
  - [Shared Identifiers, Contracts \& Units (ENG04 Baseline)](#shared-identifiers-contracts--units-eng04-baseline)
  - [Project Management \& Timeline](#project-management--timeline)
  - [Definition of Done (DoD)](#definition-of-done-dod)
    - [General](#general)
    - [Testing \& Review Pairings](#testing--review-pairings)
  - [Risk Register](#risk-register)
  - [Additional Notes](#additional-notes)


## Sprint Details
- **Sprint:** Sprint 3
- **Official Duration:** November 23 - January 3
- **Deadline:** January 3, 23:59
- **Team Size:** 4 students (Iva Silva, Diogo Silva, João Ferreira, Gonçalo Tavares)
- **Product Owner:** Paulo Sérgio dos Santos Matos
- **Sprint Review:** December 28 - January 3
- **Sprint Retrospective:** January 4 - January 8

## Sprint Goal
Deliver a fully integrated, reproducible, and resilient final increment of the **LaPrizza** system connecting confirmed customer pizza orders to AI-driven Prolog preparation plans, real-time operational execution tracking, an AI-directed 3D animated kitchen, high-availability infrastructure with validated disaster recovery, and functional GDPR data-subject workflows.

## Expected Outcome
- **Order-to-Kitchen Pipeline:** Atomic table-marker reservation (`M01–M99`), pizza work-item queueing, and execution tracking separated cleanly from simulations.
- **AI Scheduling & Studies:** Two-stage Prolog scheduler (assembly + multi-capacity ovens) minimizing total table waiting time and readiness gaps, exhaustive complexity analysis, two comparative heuristics, robotics/CV ROI study, and a generative-AI promotional video.
- **Integrated SPA & 3D Viewer:** Operational workspaces for ordering, planning/replanning, and execution, plus an AI-driven 3D assembly line supporting special pizzas, hover picking, completion overlays, and playback acceleration.
- **Resilience, Security & GDPR:** Load-balanced SPA, automated tiered cloud backups with restore validation, key-based SSH, SMB/NFS sharing, cross-service audit logs, versioned Privacy Policy, and data-subject rights workflows (export, rectification, erasure).
- **Quality & Documentation:** Regression test suite covering Sprints 1–3, updated architecture/contracts (`ARC06`), Evolution of the Solution report (`ENG06`), consolidated AI report (`AI11`), SGRAI 2-page report, and final immutable Git tag `sprint-3-submission`.

---

## Backlog Items

### 1. Engineering, Documentation & Cross-Cutting Architecture (ENG & ARC)

| User Story | Description | Area | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **ENG04** | Integrated Sprint Planning and Regression Evidence | ENG | High | **All Team** | **All Team** | Sprint 1 & 2 | Sprint backlog, shared JSON contracts, automated E2E/regression tests, failure-recovery demos. |
| **ENG05** | Final Demonstration and Individual Contribution | ENG | High | **All Team** | **All Team** | All Sprint 3 US | Deployment guide, `sprint-3-submission` tag ZIP, self/peer evaluations, live demo script. |
| **ENG06** | Evolution of the Solution | ENG | High | **All Team** | **All Team** | Sprint 1 & 2 Reviews | Consolidated review-issue tracker, commits/tests per fix, PDF + editable report in repo. |
| **ARC06** | Updated Architecture and Integration Contracts | ARC | High | **All Team** | **All Team** | BCK12–18, AI07, WEB11 | Updated C4/deployment diagrams, versioned API/JSON schemas, contract & E2E tests. |

### 2. Back-End Implementation (BCK)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **BCK12** | Customer Orders and Pizza Preparation Queue | High | **Gonçalo Tavares** | **João Ferreira** | Sprint 2 Orders/BOM | Unit/integration tests for atomic `M01–M99` marker locking, idempotent submission, and pending pizza feed. |
| **BCK13** | Kitchen Resources and Preparation Definitions | High | **Gonçalo Tavares** | **João Ferreira** | Sprint 2 Kitchen/BOM | Versioned employees/ovens/slots config, availability blocking intervals, and timing-rule endpoints. |
| **BCK14** | Generate and Save Preparation Plans | High | **João Ferreira** | **Gonçalo Tavares** | BCK12, BCK13, AI07 | Plan lifecycle (`Proposed`, `Saved`, `Active`, `Superseded`), version binding, and single-active-allocation checks. |
| **BCK15** | Amend Plans and Identify Missing Work | Medium | **Diogo Silva** | **Iva Silva** | BCK14, AI08 | Unplanned items query, diff preview before superseding, optimistic concurrency/version rejection tests. |
| **BCK16** | Start a Preparation Execution | High | **Iva Silva** | **Diogo Silva** | BCK14 | Execution record creation linked to Active plan, duplicate-start prevention, departure reason logging. |
| **BCK17** | Record Activity Progress and Actual Resource Use | High | **Iva Silva** | **Diogo Silva** | BCK16 | Idempotent activity start/end endpoints, chronology validation, planned-vs-actual variance tracking. |
| **BCK18** | Execution History and Completion | Medium | **Diogo Silva** | **Iva Silva** | BCK17 | Filtered history API, read-only completed records, atomic marker release only when all order pizzas finish. |

### 3. Front-End & Operational Web Workflows (WEB)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **WEB08** | Order and Execution Workspace | High | **Diogo Silva** | **Iva Silva** | BCK12, BCK16–18 | SPA order form with `M01–M99` validation, internal queue/execution views, clear simulation vs. operational badge. |
| **WEB09** | Planning and Replanning Workspace | High | **João Ferreira** | **Gonçalo Tavares** | BCK14, BCK15, AI07–08, AI12 | Algorithm selector (Exhaustive + 2 Heuristics), objective comparison table, Save/Activate confirmation modals. |
| **WEB10** | Viewer Integration and Session Recovery | High | **Iva Silva** | **Diogo Silva** | BCK13, BCK14, VIS08 | Embedded 3D viewer in SPA, config-version mismatch blocking, feed deduplication, clean route unmount/remount. |
| **WEB11** | Planning Data and Viewer Timeline Integration | High | **Gonçalo Tavares** | **João Ferreira** | BCK14, AI07, VIS08 | Shared versioned JSON contract file in repo, shared simulation clock, speed-factor control, contract validation. |

### 4. Artificial Intelligence & Planning (AI)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **AI07** | Prolog Scheduling of Pizza Assembly and Cooking | High | **Gonçalo Tavares** | **João Ferreira** | BCK12, BCK13 | Prolog two-stage scheduler matching exact dough/BOM rules and lexicographic objective (waiting time $\rightarrow$ readiness gap). |
| **AI08** | Update Pending Pizza Plans after Kitchen Changes | High | **João Ferreira** | **Gonçalo Tavares** | AI07, BCK13, BCK15 | Replanning predicate preserving completed/in-progress work and original order timestamps. |
| **AI09** | Robotics, Computer Vision and Investment Study | Medium | **Diogo Silva** | **Iva Silva** | GDP04–05 | Task analysis, 2 robot ROI & sensitivity calculations (optimistic/baseline/pessimistic), CV privacy safeguards. |
| **AI10** | Complexity of Exhaustive Oven Sequencing | High | **Diogo Silva** | **Iva Silva** | AI07 | Benchmark script & table ($N!$ growth, evaluated counts, wall-clock time, memory/timeout limits). |
| **AI11** | Consolidated AI Technical Report | High | **All Team** | **All Team** | AI07–10, AI12–13 | 4-part PDF + editable source in repo with reproducible Prolog seeds/queries and integration evidence. |
| **AI12** | Two Prolog Heuristics and Comparative Evaluation | High | **Iva Silva** | **Diogo Silva** | AI07, AI10 | Two distinct heuristics exposed via API/SPA, small-instance optimality gap vs. exhaustive, large-instance scalability. |
| **AI13** | Generative-AI Promotional Video for Pizza Planning | Low | `[Membro]` | `[Revisor]` | AI07, VIS08 | Playable video file + creation notes (tools, prompts, edits, asset credits) referenced in AI11. |

### 5. 3D Animated Kitchen & Visualization (VIS)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **VIS08** | AI-Directed Pizza Assembly-Line Animation | High | **Gonçalo Tavares** | **João Ferreira** | WEB11, AI07 | Standalone FIFO/5s mode + integrated AI-offset mode (parallel ovens, dispenser, conveyor, robotic arms, speed factor). |
| **VIS09** | Special Pizza Ingredient Selection | Medium | **Iva Silva** | **Diogo Silva** | BCK13, VIS08 | Ingredient/size toggle buttons + `Special Order!` trigger validated against size-dependent BOM without affecting stock. |
| **VIS10** | Special Pizza Preparation Tracking | Medium | **Gonçalo Tavares** | **João Ferreira** | VIS09, AI08 | Replanned insertion into active flow, persistent visual highlight/outline, button reset upon baking completion. |
| **VIS11** | Pizza Picking and Information Overlay *(Mandatory: $\ge 4$ members)* | Medium | **Diogo Silva** | **Iva Silva** | VIS08, VIS10 | Raycast hover highlight + floating viewport tooltip (type, order ID, ingredients/size; no PII). |
| **VIS12** | Baking Completion and Pizza-Ready Notification | Medium | **João Ferreira** | **Gonçalo Tavares** | VIS08, BCK17 | Centered 3s queued overlay upon baking finish (simulation vs. validated execution); *audio bell/horn N/A for 4 members*. |
| **VIS13** | Background Music *(Mandatory only for $\ge 5$ members)* | N/A | — | — | — | Not required for a 4-student team (optional if time permits). |
| **VIS14** | Audio Controls *(Mandatory only for $\ge 5$ members)* | N/A | — | — | — | Not required for a 4-student team (optional if time permits). |

### 6. Infrastructure, Continuity & Security (SYS & AA)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **AA08** | Operational Permission Matrix and Enforcement | High | **Gonçalo Tavares** <br> **Diogo Silva** | **João Ferreira** <br> **Iva Silva** | BCK12–18, WEB08–10, GDP05 | Role/ownership permission matrix enforced in SPA & APIs; guest order-token isolation; negative API tests. |
| **AA09** | Cross-Service Security and Operational Audit Evidence | High | **João Ferreira** <br> **Iva Silva** | **Gonçalo Tavares** <br> **Diogo Silva** | AA08, SYS15–16 | Structured audit logs with correlation IDs across SPA/Back-end/AI/Infra; staging access test matrix. |
| **SYS09** | Disaster Recovery Plan and Exercise | High | **João Ferreira** | **Gonçalo Tavares** | SYS13, SYS18 | Documented DR runbook + executed recovery drill measuring RTO/RPO/WRT and end-to-end functional validation. |
| **SYS10** | Infrastructure for a Twenty-Minute Downtime Target | Medium | **Iva Silva** | **Diogo Silva** | SYS09 | Architecture/cost/capacity design for $\le 20\text{ min}$ MTD, comparing measured RTO vs. target and quantifying gaps. |
| **SYS11** | Final Business Impact and Risk Review | Medium | **João Ferreira** | **Gonçalo Tavares** | SYS09, SYS10 | Updated BIA and Sprint 2 $\rightarrow$ Sprint 3 risk register matrix linked to continuity objectives. |
| **SYS12** | Load Balancing and Failover for the SPA | High | **Gonçalo Tavares** | **João Ferreira** | WEB08–10 | $\ge 2$ SPA instances behind health-checked reverse proxy; node-kill failover test with latency/availability logs. |
| **SYS13** | Scheduled Cloud Database Backups | High | **Diogo Silva** | **Iva Silva** | BCK12–18, GDP04–05 | Automated cron/systemd backups (`<db-name>_yyyymmdd`), overwrite protection, encrypted cloud transfer logs. |
| **SYS14** | Automated Tiered Backup Retention | Medium | **Iva Silva** | **Diogo Silva** | SYS13 | Retention script (7 daily, 4 weekly, 12 monthly) with `--dry-run`, boundary tests, and last-valid-copy safeguard. |
| **SYS15** | Backup Logging and Administrator Alerts | Medium | **Iva Silva** | **Diogo Silva** | SYS13, SYS14, SYS18 | Syslog/journald entries + persistent SSH login MOTD/banner alert on failure, cleared only after validated success. |
| **SYS16** | Key-Based Administrative SSH Access | High | **Diogo Silva** | **Iva Silva** | Sprint 2 SSH/MFA | Password/keyboard-interactive SSH disabled; individual SSH keys + non-password MFA; revocation & lockout tests. |
| **SYS17** | Authenticated SMB or NFS Resource Sharing | Low | **Gonçalo Tavares** | **João Ferreira** | SYS16 | Authenticated SMB/NFS share with read/admin-write ACLs, Linux/Windows mount guides, and denied-write logs. |
| **SYS18** | Automated Restore and Integrity Validation | High | **Diogo Silva** | **Iva Silva** | SYS13, GDP05 | Isolated temp-DB restore script running integrity queries + GDP05 erasure reconciliation + cleanup. |

### 7. GDPR & Data Protection (GDP)

| User Story | Description | Priority | Assigned To | Tested & Reviewed By | Dependencies | Acceptance Evidence (ENG04) |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **GDP04** | Privacy Policy Presentation | High | **All Team** | **All Team** | AA08, AA09 | Public footer route + archived immutable policy versions (ID, timestamp, publisher) aligned with GDPR Arts. 13–14. |
| **GDP05** | Exercise of Data Subjects' Rights | High | **All Team** | **All Team** | AA08, AA09, SYS18 | SPA workflows for JSON/PDF personal-data export, rectification, and erasure with request receipts & handler review. |

---

## Shared Identifiers, Contracts & Units (ENG04 Baseline)
To satisfy **ENG04** before implementing dependent features:
- **Canonical Identifiers:** `orderId` (UUID), `deliveryMarker` (`M01–M99`, atomic lock per active order), `pizzaWorkItemId` (UUID + monotonic `acceptanceSeq`), `kitchenConfigVersion` (semver/hash), `planId` & `planVersion`, `executionId` & `operationId`, `correlationId` (HTTP header `X-Correlation-Id` propagated across SPA $\rightarrow$ Back-end $\rightarrow$ AI).
- **Time & Units:** All planning durations and offsets are in **integer seconds** relative to `planOrigin` (ISO-8601 UTC timestamp). Presentation speed factor (`speedFactor >= 1`) scales playback clock only.
- **Shared Contract Artifact:** Maintain `/docs/contracts/planning-contract-v1.json` in the repository with a complete synthetic multi-table + special-pizza example shared across Back-end, AI, SPA, and 3D Viewer tests.

---

## Project Management & Timeline

| Week | Dates | Focus / Deliverables |
| :---: | :--- | :--- |
| **Week 1** | Nov 23 – Nov 29 | **Foundation & Contracts (`ENG04`, `ARC06`):** Consolidate Sprint 1 & 2 review feedback (`ENG06`). Freeze shared JSON planning contract, IDs, units, and permission matrix (`AA08`). Start `BCK12`, `BCK13`, `AI07` core scheduling, `VIS08` standalone mode, and `SYS16` SSH keys. |
| **Week 2** | Nov 30 – Dec 06 | **Core Engine & Persistence:** Complete `BCK12–15` (queue, resources, plan lifecycle), `AI07` & `AI10` (exhaustive benchmark), `WEB08` (ordering & queue UI), `VIS09–10` (special pizza selection/tracking), and `SYS13–14` (cloud backups & retention). |
| **Week 3** | Dec 07 – Dec 13 | **Integration & Execution Tracking:** Implement `BCK16–18` (execution & history), `AI08` (replanning) & `AI12` (two heuristics), `WEB09–11` (planning UI & 3D timeline bridge), `VIS11–12` (picking & completion overlays), and `GDP04–05` (Privacy Policy & data-subject rights). |
| **Week 4** | Dec 14 – Dec 20 | **Resilience, Audit & Studies:** Complete `SYS12` (SPA load balancing), `SYS15`, `SYS17`, `SYS18` (alerts, SMB/NFS, automated restore), `AA09` (cross-service audit evidence), `AI09` (robotics/CV ROI study), and `AI13` (generative-AI promotional video). |
| **Week 5** | Dec 21 – Dec 27 | **DR Exercise, Regression & Reports:** Execute Disaster Recovery drill (`SYS09`) and finalize `SYS10–11` (20-min MTD & BIA). Run full regression & failure-recovery test suite (`ENG04`). Draft `AI11` (consolidated AI report), `ENG06` (Evolution report), and SGRAI 2-page PDF. |
| **Week 6** | Dec 28 – Jan 03 | **Final Polish, Tag & Submission (`ENG05`):** Finalize all PDFs and editable sources, verify clean bootstrap/seed scripts, rehearse end-to-end demo script, create immutable tag `sprint-3-submission`, and submit archive on Moodle by Jan 3, 23:59. |

---

## Definition of Done (DoD)

### General
- **Code & Architecture:** Implemented following DDD principles in the Back-end (JavaScript/Node.js), reusing existing REST conventions, authentication, and domain invariants without duplicating state across SPA, AI, or 3D Viewer.
- **Testing & Coverage:** Unit test coverage (domain + controller packages) $\ge 90\%$ using the Dummy approach; automated integration, contract (`ARC06`), and regression tests (`ENG04`) passing in CI.
- **Security & Privacy:** Role-based and ownership access controls (`AA08`) verified with positive and negative tests; audit trails (`AA09`) active without leaking credentials or unnecessary PII; GDPR erasure/rectification respected during backup restores (`SYS18`, `GDP05`).
- **Simulation Isolation:** Clear visual and technical separation between operational records and simulations/replays (no stock deduction, order creation, or marker reservation during simulations).
- **Peer Review & Traceability:** Linked to a GitHub Issue, reviewed and tested by the designated peer reviewer, merged cleanly, and documented in `ARC06` / `ENG06` / `AI11` / SGRAI report as applicable.

### Testing & Review Pairings

| Implemented By | Tested & Reviewed By |
| :---: | :---: |
| Gonçalo Tavares | João Ferreira |
| João Ferreira | Gonçalo Tavares |
| Diogo Silva | Iva Silva |
| Iva Silva | Diogo Silva |

---

## Risk Register

| Risk | Impact | Mitigation |
| :--- | :---: | :--- |
| **Contract mismatch between Back-end, Prolog AI, SPA, and 3D Viewer** | High | Freeze `/docs/contracts/planning-contract-v1.json` in Week 1 (`ENG04`) and validate payloads with automated contract tests (`ARC06`). |
| **Prolog exhaustive search (`AI10`) timing out on larger instances** | Medium | Enforce strict time/memory budgets in Prolog, stream permutations where possible, and clearly separate measured results from extrapolations. |
| **Desynchronization between 3D animations (`VIS08`) and AI plan offsets** | High | Drive all 3D tweens (dispenser, conveyor, arms, ovens) from a single shared simulation clock anchored to `planOrigin` and `speedFactor`. |
| **Race conditions on delivery markers (`M01–M99`) or plan activation (`BCK14`)** | High | Use atomic database transactions/locks on marker reservation/release and optimistic version checks when superseding plans. |
| **Backup restore (`SYS18`) reintroducing erased GDPR user data (`GDP05`)** | High | Maintain a persistent GDPR erasure/restriction ledger outside restored snapshots or apply post-restore reconciliation hooks documented in `SYS18`. |
| **High workload across 5 course units during holiday/exam period** | High | Parallelize independent tracks in Weeks 1–2 (Infra/SYS, AI Prolog core, Standalone 3D, Back-end queue) and lock feature freeze by Dec 27. |

---

## Additional Notes
- GitHub commits must be made regularly and linked to their respective GitHub Issues.
- The bootstrap process must be reproducible — ensure seed scripts are committed and documented.
- Backend must be implemented in JavaScript.
- Test coverage (domain + controller packages) must not fall below 90% at any commit.
- Tag the final verified commit as `sprint-3-submission` before generating the Moodle submission archive.