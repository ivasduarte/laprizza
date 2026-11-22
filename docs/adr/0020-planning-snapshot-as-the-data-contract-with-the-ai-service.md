# Planning Snapshot as the Data Contract with the AI Service

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: [AI06] Back-End Data and Prolog Knowledge Base

## Context and Problem Statement

The AI Scheduling Module (SWI-Prolog) needs the pizza BOM, aggregates, products, stock, orders or forecasts and supplier offers to calculate. AI06 requires that it obtains them from documented back-end endpoints through authorized access, without direct database access or a separate authoritative copy, without customer data, and with the origin and version of every input recorded. We must decide how the data reaches the Prolog service.

## Decision Drivers

* The back end stays the only owner and source of the business data.
* One consistent input set per calculation, traceable to its versions.
* The user's token should not be needed by the AI service in the normal flow.
* The service must also be testable on its own.

## Considered Options

* Direct database access from Prolog
* One endpoint per kind of data (products, BOM, stock, forecast, suppliers)
* One planning snapshot endpoint, delivered either by pull (with the user's token) or by push (from the back end, with a service key)

## Decision Outcome

Chosen option: "One planning snapshot endpoint, delivered by pull or push".

* `GET /ai-data/snapshot` (permission `planning:execute`) returns one document with everything a calculation needs and `meta` (`snapshotId`, `retrievedAt`, `simulated`, `sources` with the origin and version of each input). With `scenarioId` and `stockMode` it is the scenario snapshot used by the calculations.
* **Push (AI05, main path):** the back end builds the snapshot itself and sends it with `{ request, snapshot }` to `POST /service/{bom,requirements}`, authenticated with `X-Api-Key` (`AI_SERVICE_KEY`). The Prolog service does not call the back end.
* **Pull (AI01, alternative path):** `POST /bom` and `POST /requirements` of the Prolog service accept a Manager token and use it to call `GET /ai-data/snapshot`. The token is never logged nor returned.
* Missing or invalid data is reported in `issues` by the back end and as problems by the knowledge base; no default values are invented.

### Positive Consequences

* One contract to document, test and version; the snapshot can be stored as a fixture.
* The versions of the inputs come from the back end and are recorded in the planning run ([ADR-0047](./0047-recording-planning-runs-with-their-input-versions.md)).
* In the push path the AI service only needs a shared key ([ADR-0018](./0018-secrets-management-strategy.md)).

### Negative Consequences

* The whole snapshot is built and sent for every calculation, even when only part of it is used.
* Two paths to keep consistent; the pull path cannot choose a forecast or supplier scenario version.

## Pros and Cons of the Options

### Direct database access

* Good, because there is no endpoint to maintain.
* Bad, because it breaks the ownership of the back end and the authorization model.

### One endpoint per kind of data

* Good, because each endpoint is small.
* Bad, because several requests can read data at different moments and mix versions.

### One snapshot, pull or push

* Good, because each calculation gets one consistent, traceable input set.
* Bad, because the snapshot format couples the back end and the knowledge base.
