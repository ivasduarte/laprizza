# Pull-Based Deployment from the Staging VM

- Status: accepted
- Deciders: Development Team
- Date: 2026-11-04

Technical Story: [SYS01] Automated Deployment and Validation

## Context and Problem Statement

SYS01 requires that at least one module is deployed through an automated pipeline to a reproducible, isolated environment of the DEI, that the deployment is validated with the project test plan, that logs and test results are archived, that the schedule is configurable and that a failed validation is never presented as a successful deployment. The module chosen is the back end, on the staging VM `laprizza-backend` (`10.9.22.22`).

The obvious choice, a GitHub Actions workflow deploying to the VM, is not available: the `Departamento-de-Engenharia-Informatica` organization disables self-hosted runners ("Self-hosted runners were disabled by your organization admin"), and the VM is on the DEI internal network, reachable only through the ISEP VPN, so GitHub-hosted runners cannot reach it. Opening the external SSH mapping of the DEI panel would expose the VM to the internet, against SYS02. The VM can reach GitHub over HTTPS, but the DEI network blocks outbound port 22. We must decide how a new version reaches the VM.

## Decision Drivers

- Fully automated and repeatable, with a configurable schedule (SYS01).
- Nothing from outside may connect to the VM (SYS02).
- Work within the policy of the GitHub organization.
- No deployment secrets stored in GitHub; the VM only needs read access to the repository ([ADR-0017](./0017-secrets-management-strategy.md)).
- The deployment, its validation and its logs must be checkable on the VM.

## Considered Options

- GitHub Actions with a self-hosted runner on the VM
- GitHub-hosted runner deploying over SSH through the public `vsgate-ssh` mapping
- A webhook from GitHub to the VM
- The VM pulls the repository on a schedule (systemd timer) and deploys itself
- Manual deployments

## Decision Outcome

Chosen option: "The VM pulls the repository on a schedule and deploys itself", because it is the only automated option that works without runners and without exposing the VM.

- `laprizza-deploy.timer` starts `laprizza-deploy.service` every 30 minutes (`OnCalendar=*:0/30`, changed with `systemctl edit`). The service runs `laprizza-deploy.sh deploy` as the `deploy` account; administrators can also run it by hand, publish another branch (`DEPLOY_BRANCH`) or the same commit again (`FORCE=true`).
- The script fetches the configured branch (`main`) and stops when the commit is already running, so nothing is restarted without a change. A lock (`flock`) allows only one run at a time.
- A new commit is built and validated (`npm ci`, lint, tests of the test plan, database reachable, migrations), activated, and checked through `/health` and `/version`; an unhealthy release is rolled back automatically ([ADR-0049](./0049-release-directories-and-systemd-instead-of-containers.md)).
- Each run writes the logs of every step (including the full test output in `tests.log`) to `/var/log/laprizza/deploys/<timestamp>-<action>-<sha>/` and one line (`SUCCESS`, `FAILED`, `DB_UNAVAILABLE`, `FETCH_FAILED`, `ROLLED_BACK`, `ROLLBACK_FAILED`) to `history.log`. Any status other than `SUCCESS` ends the service with exit code 1.
- GitHub is read with a **read-only deploy key** for this repository only, over SSH on port 443 (`ssh.github.com`).

### Positive Consequences

- The VM only makes outbound requests; nothing listens for deployments.
- No runner, no webhook and no deployment secret in GitHub; the deploy key cannot push and reaches one repository.
- Every run leaves its logs, its test report and its result on the VM.
- The same script later served the front end (`laprizza-deploy-web.sh`) and production (`DEPLOY_TAG`).

### Negative Consequences

- A merge reaches staging up to 30 minutes later, unless the pipeline is started by hand.
- The result is not shown in GitHub; it is read on the VM (`laprizza-deploy.sh status`, logs).
- A broken commit on `main` is retried, and recorded as `FAILED`, on every run until it is fixed.

## Pros and Cons of the Options

### Self-hosted runner on the VM

- Good, because results appear in GitHub and the runner reaches the VM from the inside.
- Bad, because the organization disables self-hosted runners.

### GitHub-hosted runner over SSH through `vsgate-ssh`

- Good, because it uses a standard workflow.
- Bad, because the VM's SSH would be open to the internet (SYS02) and a private key to the VM would be stored in GitHub.

### Webhook from GitHub to the VM

- Good, because a merge is deployed at once.
- Bad, because the VM is not reachable from the internet.

### Pull on a schedule

- Good, because it works inside the DEI network and the organization policy, and the VM keeps full control of what it runs.
- Bad, because of the delay between a merge and its deployment, and because the results are only on the VM.

### Manual deployments

- Good, because they need no tooling.
- Bad, because they are neither automated nor repeatable (SYS01).
