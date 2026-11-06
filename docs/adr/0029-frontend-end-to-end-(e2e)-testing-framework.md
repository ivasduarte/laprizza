# Frontend End-To-End (E2E) Testing Framework

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-05

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

The team does not have an End-to-End (E2E) testing tool configured for the frontend. It is necessary to automate browser tests to validate the behavior of the Kitchen Configuration page (RBAC, active configuration switching, and rejection of invalid imports).

## Decision Drivers

* Speed ​​of execution and stability of the tests.
* Native support for multiple modern browsers (Chromium, Firefox, WebKit).
* Ease of intercepting and simulating network responses (Mocking/Stubbing) to test API error states.

## Considered Options

* Cypress
* Playwright

## Decision Outcome

Chosen option: "Playwright", because it offers greater reliability, faster execution in CI pipelines, and a `async/await` native asynchronous syntax that aligns with the rest of the team's code.

### Positive Consequences

* Faster and more robust testing, without concurrency issues or promise chaining.

### Negative Consequences

* The team needs to adapt to the Playwright API.

## Pros and Cons of the Options

### Cypress

* Good, because it has an excellent visual interface and is easy to learn
* Bad, because it doesn't natively support testing across multiple tabs/windows, and network handling (intercept) can be asynchronous in a less predictable way

### Playwright

* Good, because it uses standard syntax `async/await`, has full native support for WebKit (Safari), is extremely fast, and the mechanism `page.route` allows for very reliable API mocking
* Bad, because the community and community plugins are slightly smaller compared to Cypress
