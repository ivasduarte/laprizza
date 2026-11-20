# Recording Planning Runs with Their Input Versions

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-19

Technical Story: [WEB07] Artificial Intelligence Configuration and Execution

## Context and Problem Statement

WEB07 requires that the Manager consults the results of the executions and that each result is associated with the forecast version, the stock snapshot, the pizza BOM and the supplier scenario it used. The AI Scheduling Module only calculates and does not store anything. We must decide where results are kept and how their inputs are identified.

## Decision Drivers

* Every result must be traceable to its exact inputs.
* The AI Scheduling Module must stay stateless and must not be trusted to report its own inputs.
* A planning execution must never change the stock.

## Considered Options

* Do not store results; recalculate when needed
* Store the result only
* Store each successful result as a planning run with the versions of its inputs, taken from the snapshot built by the back end

## Decision Outcome

Chosen option: "Store each successful result as a planning run with the versions of its inputs", because it meets the association requirement without changing the AI service.

* After a successful calculation `PlanningService` saves a `PlanningRun` (append-only collection): `kind`, `request` (`scenarioId`, `stockMode`, `forecastId`, `supplierScenarioId`), `snapshotId`, the AI `scenario`, `forecast` and `supplierScenario` as `{ id, name, version }`, `bomVersion` (hash of the catalogue and BOM), `stockSource`, `status`, the full `result` and `requestedBy`.
* The versions come from `meta` and the content of the snapshot that the back end built (`toPlanningRunRecord`), not from the AI answer.
* A failed calculation saves nothing. The run is the only document written by an execution: stock and orders are never changed.
* `GET /planning/runs` returns at most 100 summaries (no `result`), newest first, filtered by `kind`, `forecastId` or `supplierScenarioId`; `GET /planning/runs/{id}` returns the full result.

### Positive Consequences

* A result can be consulted later with its inputs, even after those inputs were edited (new version) or deactivated ([ADR-0033](./0033-immutable-versioned-forecasts-and-supplier-scenarios.md)).
* The snapshot id and the BOM hash show whether two runs used the same data.

### Negative Consequences

* Each run stores a full result, so the collection grows; there is no retention policy yet.
* The stock is identified by the snapshot hash, not by a stored copy of the stock.

## Pros and Cons of the Options

### Do not store results

* Good, because no new collection is needed.
* Bad, because the stock changes, so a recalculation does not give the same result.

### Store the result only

* Good, because it is simple.
* Bad, because the result alone cannot prove which forecast version, BOM or supplier scenario was used.

### Planning run with input versions from the snapshot

* Good, because the back end, which built the input, records it.
* Bad, because the record depends on the snapshot metadata (`meta.sources`) staying stable.
