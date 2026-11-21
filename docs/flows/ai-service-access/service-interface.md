# AI05 - AI Service Interface

Representative requests, responses and error cases of the planning interface. The back-end routes are also in the OpenAPI document (`/api/v2/docs`, `/api/v2/openapi.json`). The Prolog routes are documented only here and in the tests (`ai-scheduling/test/service.plt`, `server.plt`).

All bodies are JSON. Errors always have the form `{ "error": { "status", "code", "message", "details"? } }`. Long arrays are shortened with `...`, and ids such as `c-mozzarella` stand for the back-end ids of the snapshot.

## 1. Back end (used by the Web Application)

Base URL `/api/v2`. Every request needs `Authorization: Bearer <access token>` of a user with `planning:execute` (MANAGER).

### 1.1 Bill of Materials: success

```http
POST /api/v2/planning/bom
Authorization: Bearer <token>
Content-Type: application/json

{ "scenarioId": "DEMO-PARTIAL", "stockMode": "scenario" }
```

```json
200 OK
{
  "runId": "6afdb2ce653532f5e331aa01",
  "status": "ok",
  "simulation": true,
  "feasible": false,
  "calculatedAt": "2026-11-17T09:00:00.000Z",
  "scenario": { "id": "DEMO-PARTIAL", "name": "Demo", "version": 1, "stockMode": "scenario" },
  "inputs": { "snapshotId": "39f659e4dbf709b3", "sources": { "catalogue": { "version": "..." }, "stock": { "source": "scenario" } } },
  "orders": [
    { "orderId": "DEMO-PARTIAL#1", "pizzaId": "p-margherita", "pizzaName": "Margherita", "sizeId": "s-medium", "sizeName": "Medium", "quantity": 2 }
  ],
  "items": [
    { "productId": "c-mozzarella", "name": "Mozzarella", "kind": "simple", "stockControlled": true,
      "required": 4, "requiredDirect": 4, "requiredFromAggregates": 0, "available": 2, "used": 2, "remaining": 0, "shortage": 2 }
  ],
  "shortages": [ { "productId": "c-mozzarella", "name": "Mozzarella", "kind": "simple", "replenishmentNeeded": 2 } ],
  "production": [],
  "warnings": [ { "code": "PIZZA_STOCK_IGNORED", "pizzaId": "p-margherita" } ]
}
```

`feasible: false` with `shortages` is a successful calculation. It means that the stock is not enough, and nothing is bought or changed.

### 1.2 Requirements Planning: success

```http
POST /api/v2/planning/requirements
Authorization: Bearer <token>
Content-Type: application/json

{ "scenarioId": "DEMO-PARTIAL", "stockMode": "live",
  "forecastId": "6b01e3a2cd2b61a4dcc6bf10", "supplierScenarioId": "6b01e3a2cd2b61a4dcc6bf12" }
```

`200 OK` with `{ status: "ok", simulation: true, calculatedAt, scenario, inputs, plan, summary, requirements[], production[], purchases[], warnings[], runId }`. `purchases[]` holds, per day and product, the chosen supplier, price, stock units, order and delivery dates, and the unmet quantities. They are suggestions only. The full example is in the OpenAPI document and in [WEB07 UC9](../ai-planning/execute-forecast.md).

### 1.3 Invalid input

```json
400 Bad Request
{ "error": { "status": 400, "code": "VALIDATION_ERROR", "message": "Validation failed.",
  "details": [ { "field": "stockMode", "type": "any.only", "message": "\"stockMode\" must be one of [live, scenario]" } ] } }
```

```json
400 Bad Request
{ "error": { "status": 400, "code": "SCENARIO_WITHOUT_STOCK", "message": "The scenario has no stock of its own; use stockMode=live." } }
```

```json
404 Not Found
{ "error": { "status": 404, "code": "AI_SCENARIO_NOT_FOUND", "message": "AI scenario not found." } }
```

`FORECAST_NOT_FOUND` and `SUPPLIER_SCENARIO_NOT_FOUND` use the same format. A body that is not valid JSON answers 400 `MALFORMED_JSON`. In all these cases nothing is read, nothing is calculated and nothing is saved.

### 1.4 Missing information

```json
422 Unprocessable Entity
{ "error": { "status": 422, "code": "AI_INVALID_DATA",
  "message": "The data needed for the calculation is invalid or incomplete.",
  "details": {
    "scenario": { "id": "DEMO-PARTIAL", "name": "Demo", "version": 1, "stockMode": "scenario" },
    "inputs": { "snapshotId": "39f659e4dbf709b3", "sources": {} },
    "problems": [ { "code": "MISSING_SCENARIO_STOCK", "productId": "c-mozzarella", "required": 4 } ] } } }
```

Other problem codes: `INCOMPLETE_RECIPE`, `INVALID_SIZE`, `NOT_PREDEFINED_PIZZA`, `SCENARIO_MISMATCH`, `MISSING_FORECAST`, and the knowledge-base codes of [AI06](../ai-knowledge-base/README.md#business-rules-shown-in-the-diagrams) (`UNKNOWN_ITEM`, `INVALID_QUANTITY`, `NESTED_AGGREGATE`, ...).

### 1.5 Service unavailable

```http
503 Service Unavailable
Retry-After: 5

{ "error": { "status": 503, "code": "AI_SERVICE_UNAVAILABLE", "message": "The AI service is not available.",
  "details": { "reason": "connection_failed" } } }
```

`details.reason` is one of the following:

| Reason | Meaning |
|---|---|
| `connection_failed` | The Prolog service is down or unreachable |
| `invalid_ai_response` | The Prolog service sent an answer that is not a valid result |
| `service_auth_failed` | The Prolog service rejected the key: `AI_SERVICE_KEY` differs between the two sides. The answer also carries `aiServiceStatus` |
| `not_configured` | `AI_SERVICE_KEY` is not set in the back end |
| `ai_service_error` | Any other status of the Prolog service |

```json
504 Gateway Timeout
{ "error": { "status": 504, "code": "AI_SERVICE_TIMEOUT", "message": "The AI service did not answer in time.", "details": { "reason": "timeout" } } }
```

### 1.6 Access denied

| Request | Answer |
|---|---|
| No `Authorization` header | `401 { code: "TOKEN_MISSING" }` |
| Invalid or revoked token | `401 { code: "TOKEN_INVALID" }` / `401 { code: "SESSION_REVOKED" }` |
| Valid session without `planning:execute` (Employee, Customer, Administrator) | `403 { code: "FORBIDDEN" }` |

## 2. AI Scheduling Module (Prolog service)

Base URL `http://127.0.0.1:5000`. The service only listens on the loopback interface.

### 2.1 Service identity (push, used by the back end)

```http
POST /service/bom
X-Api-Key: <AI_SERVICE_KEY>
Content-Type: application/json

{
  "request": { "scenarioId": "DEMO-PARTIAL", "stockMode": "scenario" },
  "snapshot": {
    "meta": { "snapshotId": "39f659e4dbf709b3", "retrievedAt": "2026-11-17T09:00:00.000Z", "simulated": true, "sources": { ... } },
    "scenario": { "id": "DEMO-PARTIAL", "name": "Demo", "version": 1, "stockMode": "scenario" },
    "products": [ ... ], "sizes": [ ... ], "pizzas": [ ... ], "bom": [ ... ], "aggregates": [ ... ],
    "stock": [ ... ], "orders": [ ... ], "forecast": null, "supplierScenario": null, "issues": []
  }
}
```

The snapshot is the document of `GET /ai-data/snapshot` ([format](../ai-knowledge-base/snapshot-format.md)). A 200 answer is the result of 1.1 without `runId`, which only the back end adds. `POST /service/requirements` takes the same body.

| Case | Answer |
|---|---|
| No `X-Api-Key`, wrong key, a user Bearer token instead of the key, or `AI_SERVICE_KEY` not configured | `401 { code: "SERVICE_UNAUTHORIZED", message: "Service authentication required." }` |
| `request` or `snapshot` missing, or not an object | `400 VALIDATION_ERROR`, `details: [{ field: "snapshot", type: "any.required", ... }]` |
| Invalid request field | `400 VALIDATION_ERROR`, field with the prefix, for example `request.stockMode` |
| Snapshot of another scenario, or data that block the calculation | `422 AI_INVALID_DATA`, `details { scenario, inputs, problems }` |
| `GET` on a calculation route / unknown path | `405 METHOD_NOT_ALLOWED` / `404 NOT_FOUND` |

### 2.2 User token (pull, direct calls)

```http
POST /bom
Authorization: Bearer <Manager access token>
Content-Type: application/json

{ "scenarioId": "DEMO-PARTIAL", "stockMode": "scenario" }
```

The service fetches the snapshot with the same token (`GET {AI_BACKEND_URL}/ai-data/snapshot?scenarioId&stockMode`), so the back end decides whether the user may calculate.

| Case | Answer |
|---|---|
| No `Authorization` header | `401 TOKEN_MISSING` (the back end is not called) |
| Body without `stockMode` | `400 VALIDATION_ERROR`, `details: [{ field: "stockMode", type: "any.required", ... }]` |
| Employee token | `403` of the back end, returned as received |
| Unknown scenario | `404 AI_SCENARIO_NOT_FOUND`, `details: { scenarioId }` |
| Other 400 of the back end, or invalid data | `422 AI_INVALID_DATA` |
| Back end down, invalid answer or 5xx | `503 AI_DATA_UNAVAILABLE`, `details.reason`: `connection_failed`, `invalid_backend_response`, `backend_error` or `unexpected_backend_response` (with `backendStatus`) |
| Back end too slow (`AI_BACKEND_TIMEOUT_SECONDS` + 0.5 s) | `504 AI_DATA_TIMEOUT` |

### 2.3 Health

```http
GET /health
```

```json
200 OK
{ "status": "ok", "backend": "http://127.0.0.1:3000/api/v1" }
```

This route does not call the back end.

## 3. Where each case is checked

| Case | Automated check |
|---|---|
| BOM and requirements success, stock unchanged | `bom-demo-test-flow.http` (steps 3 to 7c), `planning-test-flow.http` (steps 3 to 3.2c) |
| Invalid input | `planning-errors.test.js`, `bom-demo-test-flow.http` (13), `planning-test-flow.http` (3.3), `service.plt` |
| Missing information | `ai-service.client.test.js` (422), `service.plt` (`snapshot_of_another_scenario_is_422`), `bom.plt` |
| Service unavailable | `ai-service.client.test.js` (503 reasons, `Retry-After`, 504), `planning.service.test.js` (no run saved) |
| Access denied | `api.authorization-matrix.test.js`, `service.plt` (key missing or wrong, user token, routes closed without a key), `bom-demo-test-flow.http` (8, 11) |
