# Sprint 3 Specification of Resilience and Failure Recovery

It defines the deterministic behaviour of the system in the event of network failure, concurrency, or service unavailability, guaranteeing zero silent duplication.

## 1. Recovery Matrix

| Failure Scenario | Detection Mechanism | System Behaviour | HTTP Code / Error | Recovery Procedure (Client / Operator) |
|:----------|:--------|:---------|:---------|:--------|
| Duplicate Orders (Order / Execution) | Header `Idempotency-Key` + payload hash. | **Same payload:** Returns the original response without creating a new record. <br> **Different payload:** Blocks the operation. | `200 OK` (replay) <br> or <br> `409 IDEMPOTENCY_CONFLICT` | If `200 OK`, use the returned source. If `409`, generate a new `Idempotency-Key` if it is a differnet intent. |
| Obsolete Plans (`Stale Plans`) | Comparison of `snapshotId`and `expectedKitchenConfigId` in `POST /execution/start`. | It'll refuse to start execution if the active kitchen line has changed or if any order in the plan has been changed/cancelled. | `409 STALE_PLAN` | Discard the `planId` old one, invoke it `POST /planning/schedule` to generate a new plan, and try a fresh start. |
| Services Unavailable (Prolog / DB) | Timeout (`AI_SERVICE_TIMEOUT_SECONDS`) or connection failure to the Prolog / MongoDB engine. | It doesn't persist in a partial state nor does it create incomplete plans/executions. | `503 AI_SERVICE_UNAVAILABLE` <br> `503 DATABASE_UNAVAILABLE` <br> `504 AI_SERVICE_TIMEOUT` | Respect `Retry-After` and apply exponential backoff. The retry of `POST /orders` or `POST /execution/start` is safe by maintaining the same `Idempotency-Key`. |
| 3D Session Interrupted (Disconnect / Refresh) | Loss of connection in the 3D client or time lag `sequence`. | The backend keeps the execution active and ignores events that have already been processed (`eventId` duplicated or repeated `sequence <= lastEventSequence). | `200 OK` (identical event) <br> or <br> `409 DUPLICATE_EVENT_SEQUENCE` | Upon reconnecting, the viewer calls `GET /execution/{id}/state`, reconstructs the 3D scene from the current snapshot, and resumes consuming events from `lastEventSequence + 1`. |