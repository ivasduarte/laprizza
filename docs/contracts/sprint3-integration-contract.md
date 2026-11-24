# Sprint 3 Shared Contracts

- [Sprint 3 Shared Contracts](#sprint-3-shared-contracts)
  - [Shared Identifiers](#shared-identifiers)
  - [Units \& Measurement Standards](#units--measurement-standards)
  - [Shared API Contracts (`/api/v3`)](#shared-api-contracts-apiv3)
    - [Core Schemas](#core-schemas)
  - [Endpoint Surface](#endpoint-surface)
  - [Normalised Error Handling](#normalised-error-handling)


## Shared Identifiers
All persisted entities use MongoDB 24-character hex Objects (`^[0-9a-fA-F]{24}$`), matching `Product`, `PizzaSize`, `Forecast`, and `PlanningRun`.
Composite/contextual identifiers follow deterministic formats for traceability across BOM explosion, scheduling, and 3D execution.

| Identifier | Type/Pattern | Scope & Rules |
|:-----------|:-------------|:--------------|
| `orderId`  | `string` (`^[0-9a-fA-F]{24}$`) | Persisted customer order aggregate root ID. |
| `orderNumber` | `string` (`^ORD-\d{8}-\d{4}$`) | Human-readable daily sequence (e.g., `ORD-20261124-0042`). |
| `pizzaItemId` | `string` (`^[0-9a-fA-F]{24}$`) | Unique line-item ID inside an order (distinct per customised or predefined pizza unit/line). |
| `planId` | `string` (`^[0-9a-fA-F]{24}$`) | Persisted production/scheduling plan ID (links back to `planningRunId` if generated from `/planning/*`). |
| `resourceId` | `string` (`^[a-z0-9-]{1,64}$`) | Logical station/equipment ID inside `AssemblyLineConfigurationContent.elements[].id` (e.g., `arm-01`, `oven-01`, `belt-main`). |
| `resourceRef` | `{ kitchenConfigId, assemblyLineConfigId, resourceId }` | Fully qualified physical resource reference across active configurations. |
| `executionId` | `string` (`^[0-9a-fA-F]{24}$`) | Persisted execution run ID representing a real-time or simulated kitchen execution of a `planId`. |
| `taskId` | `string` (`^{planId}:{pizzaItemId}:{stepIndex}$`) | Deterministic operation ID binding a pizza item's assembly/baking step to a `resouceId`. |


## Units & Measurement Standards
Every domain module and API payload must enforce these canonical units without implicit conversions:

- **Currency (`priceEur`, `totalEur`):** `number` (`>=0`), EUR (€), rounded to 2 decimal places  at API boundaries (alings with `SupplierScenarioInput.priceEur`).

- **Inventory & BOM (`quantity`, `stockUnitsConsumed`):** `integer` (`>=0`),, abstract stock units (aligns with `Stock.quantity` and `ComponentSizeConfiguration.stockUnitsConsumed`).

- **Duration & Scheduling (`durationSeconds`, `offsetSeconds`, `leadTimedays`):**
  - Execution and assembly line tasks: `integer` (`>= 0`) in **seconds** (`s`);
  - Supplier procurement: `integer`(`>= 0`) in **days** (`leadTimeDays`).

- **Spatial & 3D Scene (`dimensions`, `position`, `scale`):** `number` in **meters** (`m`) (`y = 0`) floor plane, `+z` forward); `rotation` in **radians** (`rad`).

- **Timestamps (`createdAt`, `scheduledStartAt`, `startedAt`, `completedAt`):** ISO-8601 UTC strings (`format: date-time`).

## Shared API Contracts (`/api/v3`)
All new endpoints mount under `/api/v3` (`CURRENT_API_VERSION = v3`), require `BearerAuth`, and return `Cach-Control: no-store` on stateful/session reads.

### Core Schemas

```yaml
OrderPizzaItem:
    type: object
    required: [pizzaItemId, productId, pizzaSizeId, quanity, components, unitPriceEur]
    properties: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    productId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    pizzaSizeId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    quanity: { type: integer, minimum: 1 }
    components:
        type: array
        items:
            type: object
            required: [productId, pizzaComponentTypeId, quantity]
            properties:
                productId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
                pizzaComponentTypeId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
                quantity: { type: integer, minimum: 1 }
    unitPriceEur: { type: number, minimum: 0 }

Order:
    type: object
    required: [id, orderNumber, customerId, status, items, totalEur, createdAt]
    properties:
        id: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
        orderNumber: { type: string, example: 'ORD-20261124-0001' }
        customerId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
        status:
            type: string
            enum: [DRAFT, CONFIRMED, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED]
        items:
            type: array
            minItems: 1
            items: { $ref: '#/components/schemas/OrderPizzaItem' }
        totalEur: { type: number, minimum: 0 }
        createdAt: { type: string, format: date-time }

ProductionPlan:
  type: object
  required: [id, status, kitchenConfigurationId, assemblyLineConfigurationId, orderIds, tasks, makespanSeconds, createdAt]
  properties:
    id: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    planningRunId: { type: string, pattern: '^[0-9a-fA-F]{24}$', nullable: true }
    status: { type: string, enum: [DRAFT, APPROVED, SUPERSEDED] }
    kitchenConfigurationId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    assemblyLineConfigurationId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    orderIds:
      type: array
      items: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    makespanSeconds: { type: integer, minimum: 0 }
    tasks:
      type: array
      items:
        type: object
        required: [taskId, orderId, pizzaItemId, resourceId, operation, startOffsetSeconds, durationSeconds]
        properties:
          taskId: { type: string }
          orderId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
          pizzaItemId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
          resourceId: { type: string, minLength: 1 }
          operation:
            type: string
            enum: [DISPENSE_CRUST, ADD_COMPONENT, BAKE, TRANSFER, BOX]
          componentProductId: { type: string, pattern: '^[0-9a-fA-F]{24}$', nullable: true }
          startOffsetSeconds: { type: integer, minimum: 0 }
          durationSeconds: { type: integer, minimum: 1 }
    createdAt: { type: string, format: date-time }

ExecutionState:
  type: object
  required: [id, planId, mode, status, currentOffsetSeconds, resources, itemStates]
  properties:
    id: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    planId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
    mode: { type: string, enum: [SIMULATION, LIVE] }
    status: { type: string, enum: [READY, RUNNING, PAUSED, COMPLETED, ABORTED] }
    currentOffsetSeconds: { type: integer, minimum: 0 }
    resources:
      type: array
      items:
        type: object
        required: [resourceId, state]
        properties:
          resourceId: { type: string }
          state: { type: string, enum: [IDLE, BUSY, BLOCKED, FAULT] }
          activeTaskId: { type: string, nullable: true }
    itemStates:
      type: array
      items:
        type: object
        required: [pizzaItemId, orderId, status]
        properties:
          pizzaItemId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
          orderId: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
          status: { type: string, enum: [QUEUED, IN_ASSEMBLY, BAKING, DONE, FAILED] }
          currentResourceId: { type: string, nullable: true }
```

## Endpoint Surface

| Domain | Method & Path | Roles | Purpose |
|:-------|:--------------|:------|:--------|
| **Orders** | ´POST /orders` | `CUSTOMER, EMPLOYEE, MANAGER` | Create order (validates catalogue items, size configurations, and component min/max rules). |
| | `GET /orders` / `GET /orders{id}` | `CUSTOMER` (`:own`), `EMPLOYEE`, `MANAGER` | List or inspect orders. |
| | `PATCH /orders/{id}/status` | `EMPLOYEE`, `MANAGER`, `CUSTOMER` (cancel own `DRAFT`/`CONFIRMED`) | Transition order lifecycle. |
| **Plans** | `POST /plans` | `MANAGER` | Generate or persist a `ProductionPlan`against the active `KitchenConfiguration`. |
| | `GET /plans/{id}` / `PATCH /plans/{id}/approve` | `MANAGER`, `EMPLOYEE` (read) | Inspect schedule or lock `APPROVED` plan for execution. |
| **Execution** | `POST /executions` | `MANAGER`, `EMPLOYEE` | Initialize an execution session from as `APPROVED` `planId`. |
| | `GET /executions/{id}` | `MANAGER`, `EMPLOYEE` | Poll execution snapshot (resource states, task progress, pizza positions). |
| | `POST /executions/{id}/commands` | `MANAGER`, `EMPLOYEE` | Control execution (`START`, `PAUSE`, `RESUME`, `STEP`, `ABORT`). |


## Normalised Error Handling
The global envelope defined in (`{ error: { status, code, message, details } }`) remains unchanged, extended with the deterministic codes necessary for the integration and resilience of Sprint 3:

```json
{
    "error": {
        "status": 422,
        "code": "RESOURCE_NOT_IN_ACTIVE_LINE",
        "message": "Task references a resouceId not present in the active assembly line configuration.",
        "details": [
            { "field": "tasks[0].resourceId", "type": "resource.unknown", "message": "Unknown resourceId 'arm-99'" }
        ]
    }
}
```

| HTTP Status | `error.code` | Context / When It Occurs | Action / Semantics for the Client |
|:------|:-------|:--------|:---------------|
| 400 | `VALIDATION_ERROR` | Invalid payload, incorrectly formatted IDs, or out-of-bounds units. | Correct the data before submitting. |
| 401 / 403 | `TOKEN_EXPIRED` / `FORBIDDEN` | Session expired or profile without permission. | Renew token (`POST /auth/refresh`) or block action. |
| 404 | `ORDER_NOT_FOUND` <br> `PLAN_NOT_FOUND` <br> `EXECUTION_NOT_FOUND` | The referenced resource does not exist. | Sync resouce list. |
| 409 | `IDEMPOTENCY_CONFLICT` | Same version `Idempotency-Key` reused with a different payload. | Generate a new key if it's a distinct operation. |
| 409 | `STALE_PLAN` | Attempting to execute a task `planId` whose active kitchen/line configuration or order status has already changed. | Recalculate plan (`POST /planninh/schedule`). |
| 409 | `DUPLICATE_EVENT_SEQUENCE` | Event with `sequence <= lastEventSequence` or `eventId` already registered with different data. | Ignore (if identical) or resynchronize state (`GET /execution/{id}/state`). |
| 422 | `INSSUFICIENT_STOCK` <br> `INVALID_PIZZA_CONFIGURATION` | Insufficient stock at time or order or component rules (`minQuantity` / `maxQuantity`) violated. | Inform user/manager about missing items (`details`). |
| 503 | `AI_SERVICE_UNAVAILABLE` <br> `DATABASE_UNAVAILABLE` | Prolog or MongoDB engine unavailable. | Respect the header `Retry-After` and apply exponential backoff. |
| 504 | `AI_SERVICE_TIMEOUT` | The planning engine exceeded the time limit (`AI_SERVICE_TIMEOUT_SECONDS`0). | Allow safe retry without duplicating state. | 