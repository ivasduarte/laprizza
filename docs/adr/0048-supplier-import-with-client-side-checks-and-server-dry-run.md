# Supplier Import with Client-Side Checks and a Server Dry-Run

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-19

Technical Story: [WEB07] Artificial Intelligence Configuration and Execution

## Context and Problem Statement

Supplier data is prepared outside the system, by hand or with an LLM, as a JSON file. WEB07 requires that the Manager imports it, inspects it and confirms before saving; invalid structure, duplicates, unknown references, missing fields and invalid values must be rejected and explained, and the previous dataset must stay in use. We must decide where the file is checked and how the confirmation step works.

## Decision Drivers

* Fast and precise feedback on the file (line, column, field path).
* The back end stays the only authority on the rules.
* Nothing is stored before the Manager confirms.

## Considered Options

* Send the file directly to `POST /supplier-scenarios` and show the errors
* Check only in the browser, then save
* Check in the browser, then a server dry-run, then save on confirmation

## Decision Outcome

Chosen option: "Check in the browser, then a server dry-run, then save on confirmation", in line with [ADR-0031](./0031-import-approach.md) (file read in the browser and sent as JSON).

* **Inspect** parses the text (`parseSupplierJson`, syntax error with line and column), builds the body (`toScenarioPayload`) and runs `validateScenarioStructure`, with the same field paths and types as the Joi schema. Product references are left to the server.
* It then calls `POST /supplier-scenarios/validate`, which runs the same Joi schema and business rules as the save, stores nothing and returns `{ valid: true, nextVersion }`. The page shows the preview and "Nothing has been saved yet."
* **Confirm** sends the inspected body to `POST /supplier-scenarios`, which validates it again. Any change to the text or name discards the inspection.
* A rejected file saves nothing, so the previous scenario stays in use.
* The product export (`GET /ai-data/products/export`) is the input of the file and feeds the preview ("No configured supplier").

### Positive Consequences

* Most mistakes are explained before any request; the server explains the rest with the same paths.
* The Manager sees the version the scenario will get before saving.

### Negative Consequences

* The structural rules exist twice (browser and Joi) and must be kept in line; tests cover both.
* A confirmation runs the validation twice on the server.

## Pros and Cons of the Options

### Direct save

* Good, because it needs one request.
* Bad, because there is no inspection step before saving.

### Browser checks only

* Good, because it needs no extra endpoint.
* Bad, because the browser does not know every active product, and the rules could drift.

### Browser checks, server dry-run, confirmation

* Good, because the preview is validated by the server and nothing is stored before the confirmation.
* Bad, because it needs one more endpoint (`/validate`, registered before `/:id`).
