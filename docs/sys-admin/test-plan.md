# Project Test Plan

This plan states which automated tests the project has, where each one runs, and which of them decide whether a deployment is accepted. It is the test plan used by the deployment pipeline of [SYS01](automated-deployment/automated-deployment.md).

## Test levels

| Level | Scope | Tool | Command | Needs | Decision |
|---|---|---|---|---|---|
| Static analysis | Back end and SPA source | ESLint | `npm run lint` | Nothing | [ADR-0006](../adr/0006-continuous-integration-pipeline.md) |
| Back-end unit and API tests | Domain rules, services, controllers, routes, permission matrix, with test doubles for the repositories and external services | `node:test` (native `mock`); the API tests start the Express app on a random port and call it with `fetch` | `cd backend && npm test` | Nothing (no database, no network) | [ADR-0028](../adr/0028-mock-based-unit-testing.md) |
| Back-end integration tests | Repositories, migrations and the seeder on a real MongoDB | `node:test`, Testcontainers | `cd backend && npm run test:integration` | Docker | [ADR-0013](../adr/0013-use-testcontainers-for-automated-integration-testing.md) |
| End-to-end HTTP flows | Use cases through the running API, one `.http` file per feature (`backend/test-flows/`) | httpyac | `cd backend && npm run test:flows` | API running, `seed:dev-users`, Mailpit; the AI flows also need the Prolog service | - |
| SPA unit tests | Models, validation, error mapping, permission-driven navigation | `node:test` | `cd frontend && npm test` | Nothing | [ADR-0028](../adr/0028-mock-based-unit-testing.md) |
| SPA end-to-end tests | Pages in a real browser with a mocked API | Playwright | `cd frontend && npm run test:e2e` | Browsers installed | [ADR-0029](../adr/0029-frontend-end-to-end-%28e2e%29-testing-framework.md), [ADR-0012](../adr/0012-schedule-e2e-tests-in-nightly-builds.md) |
| AI service tests | Knowledge base, BOM, requirements and HTTP routes of the Prolog service | SWI-Prolog `plunit` | `cd ai-scheduling && ./run-tests.sh` | SWI-Prolog 9 | - |

Unit and API tests never use the staging or production database: the deployment runs them before it loads the environment of the server.

## Tests that gate a deployment

| Pipeline | Steps (in order) | A failure means |
|---|---|---|
| Back end (`deploy/laprizza-deploy.sh`) | `npm ci`, `npm run lint` (unless `RUN_LINT=false`), `npm test`, database reachable, `npm run migrate:up`, restart, then `/api/v2/health` 2xx and `/api/v2/version` with the new commit within 60 s | `FAILED` (release removed, running version unchanged), `DB_UNAVAILABLE`, or `ROLLED_BACK` after the health check |
| Front end (`deploy/laprizza-deploy-web.sh`) | `npm ci`, `npm run lint`, `npm test` (unless `RUN_TESTS=false`), `npm run build`, build checks, then `/version.json` with the new commit | `FAILED` or automatic rollback |

**Exit criterion:** a version is published only when every step passes. A failed step is never recorded as a successful deployment, and its logs and test results stay in `/var/log/laprizza/deploys/<run>/` ([SYS01](automated-deployment/automated-deployment.md#outcomes-and-records)).

## Tests run outside the pipeline

| Level | When | Why not in the pipeline |
|---|---|---|
| Integration tests | Before merging changes to repositories, migrations or the seeder | They need Docker, which the staging VM does not run ([ADR-0049](../adr/0049-release-directories-and-systemd-instead-of-containers.md)) |
| HTTP flows | Before merging a feature, and on the staging API to demonstrate it | They need a running API with seeded accounts, and they write test data |
| Playwright | Before merging changes to the SPA | They need browsers on the server |
| Prolog tests | Before merging changes to `ai-scheduling/` | The Prolog service is not deployed by this pipeline (`laprizza-update-ai.sh` in production) |

## Definition of done for tests

- New business rules come with unit tests; new endpoints with API tests and an entry in the authorization matrix.
- A feature that changes the API comes with its HTTP flow.
- `npm run lint` and `npm test` pass in `backend/` and `frontend/` before a merge.
