# ADR 0006: Continuous Integration Pipeline

**Date:** 2026-10-12
**Status:** Accepted

## Context

The backend developed in Sprint 1 is built by several team members working in parallel through Pull Requests. Without automation, quality depends on individual discipline: tests only run if the each member remembers to run them, local environments differ (Node.js version, installed packages, leftover state), and PR titles end up inconsistent, which makes the history hard to read and to trace back to a task. Reviewers then spend time on mechanical checks instead of reviewing the code.

## Decision

We adopt a **Continuous Integration pipeline** using **GitHub Actions**, defined in `.github/workflows/ci.yml`. It runs on every Pull Request (when opened, edited, synchronized or reopened) and on every push to `main`. It is composed of two prefixed jobs (`gate-backend` and `lint-pr-title`) to clearly identify their purpose in status checks:

- **Backend tests:** Installs dependencies with `npm ci` and runs `npm run test:coverage`, which executes the test suite with the Node.js built-in test runner (`node --test`) and collects coverage. It runs on a matrix of Node.js 22 and 24 (with `fail-fast` disabled), and uploads the coverage report as an artifact (Node 24 only).

- **PR title validation:** On Pull Requests only, checks that the title follows the **Conventional Commits** convention (e.g. `feat(BCK01): add user authentication`).

Additionally, the workflow follows these rules:

- It uses read-only permissions (`contents: read`), following the principle of least privilege.
- Outdated runs of the same ref are cancelled when a new commit is pushed (`concurrency`).
- The PR title is passed through an environment variable instead of being interpreted into the script, to prevent shell injection.
- The workflow and jobs have descriptive names, so a failed check states what failed without opening the logs.

## Consequences

- **Positive:** Regressions are caught before merging, in a clean and reproducible environment that doesn't depend on any team member's machine.
- **Positive:** Running on two Node.js versions guarantees compatibility with both, and the coverage report makes the test quality visible to reviewers.
- **Positive:** A uniform PR title format keeps the history readable and traceable.
- **Positive:** Reviewers no longer need to check titles or run tests manually, so review time is spent on the code itself.

- **Negative:** Every PR runs the test suite on two Node.js versions, which increases CI usage and the time until the result is available.
- **Negative:** The `.http` test flows (`npm run test:flows`) are not yet part of the pipeline, since running them requires the API to be started first, so they still have to be run manually.
- **Negative:** PRs with a non-compliant title are flagged until the title is fixed, which requires discipline from the team.
