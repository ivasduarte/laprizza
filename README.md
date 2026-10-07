# LaPrizza - Integrative Project (LEI-ISEP)

## Project Overview
LaPrizza is a modern pizza restaurant information system developed as the 5th-semester Integrative Project for the Informatics Engineering Bachelor's Degree at ISEP. 

The system supports the business and operational processes of the restaurant, from customer management and pizza configuration to order processing and kitchen scheduling.

## System Modules
The project integrates four main technological areas:
* **Web Application:** The primary interface for business capabilities (identity, catalogue, order management).
* **3D Visualization:** WebGL and Three.js modules for interactive pizza building and visual kitchen monitoring.
* **Artificial Intelligence:** A Prolog-based reasoning module for scheduling food preparation activities and managing kitchen resources.
* **Systems Administration:** Infrastructure setup ensuring secure, reproducible, and scalable deployments.

## Architecture & Engineering Practices
* **Architecture:** Domain-Driven Design (DDD). Domain and business rules are isolated from presentation and persistence mechanisms.
* **Documentation:** All architectural and domain models are documented using PlantUML.
* **Testing:** Unit tests utilize a Dummy approach instead of Mockito. Automated tests cover all relevant business rules and invariants.
* **API:** Business functionality is exposed via standardized REST APIs.

## Repository Structure
This repository contains the different applications, modules, and documentation developed throughout the semester. 

*(Note to team: Map the specific folder structure here once initialized)*
* `/backend` - Back-end application and REST APIs in Node.js.
* `/docs` - User Story documentation, PlantUML diagrams and System Architecture.

## Setup and Development Environment

## Requirements

- **Node.js >= 22.13.0** and npm.

## Install

```bash
npm install
```

## Configure

Copy the example file and adjust it if needed. Never commit `.env`.

```bash
cp .env.example .env
```

|   Variable    |         Default         |                   Description                    |
| :-----------: | :---------------------: | :----------------------------------------------: |
|  `NODE_ENV`   |      `development`      |      `development`, `production` or `test`       |
|    `PORT`     |         `3000`          |         Port the HTTP server listens on          |
| `CORS_ORIGIN` | `http://localhost:5173` |     Allowed CORS origin(s), comma-separated      |
| `MONGODB_URI` |      _(Mandatory)_      | Database connection string (e.g., MongoDB Atlas) |

If `.env` does not exist, the defaults above are used.

## Run

```bash
npm start      # run once
npm run dev    # run and restart on file changes
```

- Health check: <http://localhost:3000/api/v1/health>
- API documentation (Swagger UI): <http://localhost:3000/api/v1/docs>

All routes live under the `/api/v1` prefix. Errors are returned in a single JSON format:

```json
{ "error": { "status": 404, "code": "NOT_FOUND", "message": "Route not found: GET /api/v1/x" } }
```

## Project Management and Development Processes
 
This section describes the processes adopted by the team to manage and develop the project. The work is tracked in GitHub Projects, where every User Story (US) has a linked issue.
 
### Definition of Ready (DoR)
 
A User Story can enter a sprint only when:
1. It has a unique ID (e.g. `BCK01`) and a title, and a GitHub issue exists for it on the project board.
2. Its description is clear and its acceptance criteria are verifiable.
3. Its dependencies on other User Stories are identified and none of them blocks the start of the work.
4. It was estimated by the team (see [Estimates](#estimates)).
5. It is small enough to be completed within one sprint.
6. Open questions about the requirements were clarified with the teaching staff.
*(Note to team: this is a proposal. Adjust it to what you agree on.)*
 
### Definition of Done (DoD)
 
#### General
1. All acceptance criteria of the user story are met and verifiable.
2. Unit tests written and passing: coverage of domain and controller packages >= 90%.
3. Unit tests strictly use a **Dummy approach** (no Mockito or mocking libraries allowed).
4. Code reviewed by the designated peer tester before merging.
5. No broken build — every commit leaves the system in a valid, compilable, and testable state.
6. Documentation updated in `/docs` following **DDD architecture** and using **PlantUML** diagrams.
7. User story closed in GitHub Projects with linked issue, pull request, and commit references.
8. No unresolved technical doubts related to the implementation.
9. Bootstrap scripts updated if the US requires initial data (e.g., initial Pizza Component Types in `BCK07`).
### Scrum Ceremonies
 
| Ceremony | Purpose | Frequency and duration | Output |
|:---:|:---:|:---:|:---:|
| **Daily Meetings** | Share what was done, what will be done and any blockers. | Every working day, max. 15 min | Blockers identified and assigned. |
| **Sprint Planning** | Select the User Stories for the sprint, estimate them and split them into tasks. | Start of each sprint | Sprint backlog and sprint goal. |
| **Refinement** | Clarify, split and estimate upcoming User Stories so they meet the DoR. | Once per sprint | Backlog items that are ready. |
| **Sprint Review** | Check the delivered work against the sprint goal. | End of each sprint | Accepted User Stories. |
| **Retrospective** | Reflect on how the team worked and agree on improvements. | End of each sprint, after the review | Improvement actions for the next sprint. |
 
 
### Estimates
 
* User Stories are estimated by the whole team using **cards** (High, Medium, Low), through planning poker.
* When estimates differ, the team discusses the reasons and votes again until it reaches a consensus.
* A User Story estimated above Medium is split into smaller ones before entering a sprint.
* The final estimate is recorded on the issue in GitHub Projects.
 
### Branch Strategy
 
The team follows a simplified Git Flow:
 
* `main`: stable code only. It receives the delivered state at the end of each sprint, tagged as `sprint-N`.
* `feature/<US-ID>-<short-description>`: one branch per User Story, created from `develop` (e.g. `feature/BCK01-user-authentication`).
* `fix/<US-ID>-<short-description>`: bug fixes.
* `docs/<short-description>`: changes limited to documentation.
Branches are short-lived and deleted after the merge.

  
### Branch Protection
 
The rules below apply to `main`:
 
* No direct pushes. All changes arrive through a pull request.
* At least one approving review before merging.
* The build and the automated tests must pass before merging.
* The branch must be up to date with its base branch before merging.
* Force pushes and branch deletion are disabled.

 
### Pull Requests
 
* One pull request per User Story, targeting `main`.
* The title follows the Conventional Commits format (e.g. `feat(BCK01): add user authentication`).
* The description links the issue (`Closes #<issue>`), summarises the change and states how it was tested.
* The pull request is reviewed and approved by the designated peer tester, as required by the DoD.
* Before requesting a review, the author confirms the [Definition of Done](#definition-of-done-dod) checklist.
* Review comments are resolved before merging.
* The merge is done only when the branch protection conditions are met.
 
### Conventional Commits
 
All commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0) specification:
 
```
<type>(<scope>): <description>
 
[optional body]
 
[optional footer(s)]
```
 
* **type:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `perf` or `revert`.
* **scope (optional):** the User Story ID or the module affected (e.g. `BCK01`, `backend`, `docs`).
* **description:** short, in the imperative, in lowercase and without a final full stop.
* **footer:** issue references (e.g. `Refs #12`) and breaking changes (`BREAKING CHANGE: ...`, or `!` after the type or scope).
Examples:
 
```
feat(BCK01): add user registration endpoint
fix(BCK01): reject duplicate emails on registration
test(BCK01): add dummy repository for user tests
docs: add domain model diagram for users in PlantUML
```
 
## Sprint 1 Focus
The current iteration establishes the technical foundations:
* Project setup, repository organization, and issue tracking.
* Core domain analysis and system architecture design.
* Back-end development focusing on users, customers, products, allergens, and pizza component configurations.