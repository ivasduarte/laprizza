# Immutable Versioned Forecasts and Supplier Scenarios

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-19

Technical Story: [WEB07] Artificial Intelligence Configuration and Execution

## Context and Problem Statement

The Manager creates, edits and deletes daily consumption forecasts and supplier scenarios, and executes the planning with them. WEB07 requires that each result stays associated with the forecast version and the supplier scenario it used, and that editing a forecast does not change earlier results. We must decide what "edit" and "delete" do to a stored forecast or supplier scenario.

## Decision Drivers

* Earlier results must keep their meaning after the inputs change.
* Simple API: the same contract to create and to edit.
* No data loss when a Manager deletes something by mistake.

## Considered Options

* Update in place and hard delete
* Update in place, keeping a history collection of old versions
* Immutable documents: edit = new version of the same name, delete = deactivation

## Decision Outcome

Chosen option: "Immutable documents: edit = new version of the same name, delete = deactivation", because a stored version never changes, so every run can simply point to `{ id, name, version }` and stay correct.

* `POST /forecasts` and `POST /supplier-scenarios` always create a document. The version is `getLatestVersion(name) + 1`, comparing names without case (collation `en`, strength 2) and counting inactive versions, so a number is never reused. A `version` sent by the client is ignored.
* A unique index `{ name: 1, version: 1 }` with the same collation turns two concurrent saves of the same version into `409` ("try again").
* "Edit" in the page is a `POST` with the same name (the name is read-only in the editor).
* `PUT /{id}` accepts only `{ "isActive": false }`. Inactive documents are not listed, answer 404 by id and cannot be chosen for a new execution, but stay in the database.

### Positive Consequences

* Results keep their inputs without copying them: the forecast and supplier scenario versions are enough.
* Deleting is reversible at database level and never breaks a saved run.
* Create and edit share the same validation, route and service.

### Negative Consequences

* The collections grow with every edit; old versions are only hidden.
* A typo in a name creates a new series instead of a new version.
* There is no endpoint to reactivate a version.

## Pros and Cons of the Options

### Update in place and hard delete

* Good, because it is the simplest model.
* Bad, because a result would show a forecast that is no longer the one that was calculated, or a reference to a deleted document.

### Update in place, keeping a history collection

* Good, because the current version is always one document.
* Bad, because every update must copy the old document in the same transaction, and runs must point to the history.

### Immutable documents with versions and deactivation

* Good, because nothing that a run references can change or disappear.
* Bad, because lists must group versions by name and filter inactive ones.
