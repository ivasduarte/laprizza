# Continuous Integration Pipeline

* Status: accepted
* Deciders: Development Team
* Date: 2026-10-12

## Context and Problem Statement

The backend is built by several team members working in parallel. Without automation, tests are skipped, local environments differ, and PR titles end up inconsistent, making the history hard to read and forcing reviewers to perform mechanical checks.

## Considered Options

* GitHub Actions Pipeline (Tests + PR Linting)
* Manual Local Testing before Merges

## Decision Outcome

Chosen option: "GitHub Actions Pipeline", because it automatically runs `npm run test:coverage` on a matrix of Node.js versions and validates PR titles against the Conventional Commits convention.

## Pros and Cons of the Options

### GitHub Actions Pipeline

* Good, because regressions are caught in a reproducible environment, running on two Node versions guarantees compatibility, and a uniform PR title keeps history traceable.
* Bad, because running on multiple Node versions increases CI usage time, and PRs with non-compliant titles are flagged until fixed, requiring team discipline.

### Manual Local Testing before Merges

* Good, because it requires zero infrastructure setup.
* Bad, because it relies on human discipline, local environments vary, and reviewers waste time on mechanical checks rather than reviewing code logic.
