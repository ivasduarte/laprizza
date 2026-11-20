# Synchronous AI Execution with a Duplicate-Submission Guard

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-19

Technical Story: [WEB07] Artificial Intelligence Configuration and Execution

## Context and Problem Statement

The Manager executes a saved forecast through the AI Scheduling Module. WEB07 requires that the page shows progress and errors and prevents duplicate submission. We must decide whether the execution is synchronous or a background job, and how duplicate submissions are prevented.

## Decision Drivers

* Simple flow: one calculation per request, bounded by a timeout.
* No duplicate runs from double clicks.
* Clear failure states (invalid input, missing information, service unavailable).

## Considered Options

* Asynchronous job (queue, job id, polling)
* Synchronous request with a server-side idempotency key
* Synchronous request with a client-side lock

## Decision Outcome

Chosen option: "Synchronous request with a client-side lock".

* `POST /planning/requirements` builds the snapshot, calls the AI Scheduling Module (`POST /service/requirements`, `X-Api-Key`) and answers with the result and `runId` in the same request.
* The back end waits at most `AI_SERVICE_TIMEOUT_SECONDS` (15 s by default) and answers `504 AI_SERVICE_TIMEOUT`; a refused connection, a rejected key or a bad answer gives `503 AI_SERVICE_UNAVAILABLE` with `Retry-After: 5`; incomplete data gives `422 AI_INVALID_DATA`. The SPA request has a 30 s timeout.
* `PlanningPanel` uses a synchronous lock (`useRef`): a second click in the same tick is ignored. While the request runs, the form and the button are disabled and a `<progress>` bar and "Calculating... please wait." are shown. `classifyPlanningError` maps each failure to one state.

### Positive Consequences

* No job infrastructure; the result is shown as soon as it is calculated.
* One request per click, and failures save nothing ([ADR-0034](./0034-recording-planning-runs-with-their-input-versions.md)).

### Negative Consequences

* The lock is per page: two tabs, or two Managers, can still start the same calculation, and each successful one is saved as a run.
* Long calculations are limited by the timeouts.

## Pros and Cons of the Options

### Asynchronous job

* Good, because long calculations are not limited by HTTP timeouts.
* Bad, because it needs a queue, job states and polling, for a single calculation that already fits in one request.

### Server-side idempotency key

* Good, because it also protects against several tabs.
* Bad, because it needs a key store and expiry rules.

### Client-side lock

* Good, because it is simple and enough for the double-click case.
* Bad, because it does not cover concurrent clients.
