# Knowledge Base Loaded per Calculation

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: [AI06] Back-End Data and Prolog Knowledge Base

## Context and Problem Statement

The Prolog knowledge base is a set of dynamic facts shared by every request of the AI service. AI06 requires that data is refreshed for each calculation (or follows a documented policy) and that unavailable data or incomplete refreshes never silently mix old and new versions. We must decide when the facts are loaded, how they are protected from concurrent requests and what happens with invalid data.

## Decision Drivers

* No mixing of versions between calculations.
* Invalid data must be reported, never partially loaded.
* Simple behaviour: no refresh schedule to maintain.

## Considered Options

* Load the data periodically and keep it between requests
* Load per request without synchronization
* Load per calculation under a mutex, in one transaction, and clear the facts afterwards

## Decision Outcome

Chosen option: "Load per calculation under a mutex, in one transaction, and clear the facts afterwards".

* `with_snapshot(Snapshot, Goal)` runs `with_mutex(kb, setup_call_cleanup(true, (load_unlocked(Snapshot), once(Goal)), clear_unlocked))`.
* `load_unlocked/1` validates the whole snapshot first (`snapshot_entries/3` and `check_problem/2`). With any problem it throws `kb_error(invalid_data(Problems))`, answered as 422 `AI_INVALID_DATA`, and loads nothing. Otherwise it replaces the facts in one `transaction`.
* The facts are cleared after every calculation, even when it fails or throws.
* The back end never caches the scenario snapshot; each calculation gets a new one. If the back end does not answer, the calculation fails (503 or 504).

### Positive Consequences

* Two calculations never see each other's data, and the knowledge base is empty between requests.
* A result always corresponds to exactly one snapshot.
* Every problem of a snapshot is reported in one answer.

### Negative Consequences

* Calculations are serialized: concurrent requests wait for the mutex.
* Every calculation pays the cost of building, sending and loading the snapshot.

## Pros and Cons of the Options

### Periodic load

* Good, because the data is ready before the request.
* Bad, because a result could use data older than the stock or forecast the user sees, and a failed refresh could leave a mix of versions.

### Per request without synchronization

* Good, because requests run in parallel.
* Bad, because two requests would overwrite each other's facts.

### Per calculation, mutex, transaction, cleared after use

* Good, because it guarantees one consistent input set per result.
* Bad, because it limits throughput to one calculation at a time.
