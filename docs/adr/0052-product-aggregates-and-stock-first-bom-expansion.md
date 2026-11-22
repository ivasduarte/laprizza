# Product Aggregates and Stock-First BOM Expansion

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-10

Technical Story: [AI01] Prolog Bill of Materials and Stock Requirements

## Context and Problem Statement

A pizza consumes components (for example a dough, a sauce, a cheese) in abstract stock units that depend on its size. Some components are themselves made of other products: a dough is produced in the restaurant from flour, water and yeast, and a sauce is bought ready-made. AI01 requires that the Bill of Materials uses the available stock of an aggregate first, expands only the remaining demand into ingredients when the aggregate is produced internally, replenishes purchased aggregates directly, follows the production-or-purchase classification of the back end and never counts both an aggregate and the ingredients it already represents. Unknown items, invalid quantities and incomplete or cyclic recipes must be reported instead of producing an apparently valid result. We must decide how aggregates are modelled in the back end and how the Prolog calculation expands them.

## Decision Drivers

* The back end owns the classification and the composition; the Prolog service only reads them ([ADR-0039](./0039-planning-snapshot-as-the-data-contract-with-the-ai-service.md)).
* No double counting between an aggregate and its ingredients.
* Cycles and inconsistent compositions must be impossible or reported, never resolved silently.
* Deterministic and explainable results, so that the demonstration scenarios have fixed expected values.

## Considered Options

* A separate `Recipe` aggregate root that references products and other recipes, expanded recursively
* An optional `aggregate` value object of `Product` (one level only), expanded in two passes with the stock of the aggregate used first
* Expanding every aggregate into its ingredients and ignoring the stock of the aggregate

## Decision Outcome

Chosen option: "An optional `aggregate` value object of `Product`, expanded in two passes with the stock of the aggregate used first".

**Back end (model and validation).**

* `Product.aggregate` is `null` or `{ classification: "PRODUCED" | "PURCHASED", items: [{ productId, quantity }] }`, with integer quantities ≥ 1 in abstract stock units. It is a value object of the `Product` aggregate (see `entities.md`).
* `POST /products` and `PATCH /products/{id}` accept it (Joi `aggregateSchema`, 400 `BAD_REQUEST` with `details`). The domain rules of `products.domain.js` answer 400 with a code: a produced aggregate needs items (`AGGREGATE_PRODUCED_WITHOUT_ITEMS`), a purchased one has none (`AGGREGATE_PURCHASED_WITH_ITEMS`), no duplicate or self item, every item must exist and be active and must not be a pizza or another aggregate (`AGGREGATE_NESTED`), and a pizza or an item of another aggregate cannot become an aggregate (`AGGREGATE_OWNER_IS_PIZZA`, `AGGREGATE_OWNER_IS_ITEM`).
* Only one level is allowed, so cycles cannot exist. The knowledge base checks the same rules again on the snapshot (`NESTED_AGGREGATE`, `INCOMPLETE_AGGREGATE`, `PURCHASED_WITH_COMPOSITION`, `PIZZA_AS_COMPONENT`, `UNKNOWN_ITEM`), because the snapshot can also come from a fixture.
* The migration `ai01-bom-aggregates-and-scenarios` sets `aggregate: null` on the existing products.

**Prolog (`bom.pl`, `bom_calculate/2`).**

1. **Phase A, validation.** Every problem of the request and of the ordered pizzas is collected: `INVALID_REQUEST`, `INVALID_SNAPSHOT` (no scenario), `SCENARIO_MISMATCH`, `NOT_PREDEFINED_PIZZA`, `INVALID_SIZE` and `INCOMPLETE_RECIPE` (no BOM lines, a consumption missing or invalid, an unknown component, a produced aggregate without a measured consumption). With any problem there is no calculation and the answer is `status: "invalid_data"` (422 `AI_INVALID_DATA`) without quantities.
2. **Direct demand.** `D(c)` is the sum, over the ordered lines, of the quantity times the consumption of `c` in that pizza and size.
3. **Pass 1, aggregates.** Each aggregate uses its own stock first: `used = min(required, available)` and `shortage = required − used`. Only the shortage of a **produced** aggregate is expanded into its items (`toProduce × item quantity`). The shortage of a **purchased** aggregate is reported as a replenishment need and never expanded.
4. **Pass 2, simple products.** Each simple product is handled once, with `required = direct demand + demand derived from the produced aggregates` (`requiredDirect`, `requiredFromAggregates`).
5. **Result.** For each item: `required`, `available`, `used`, `remaining = available − used` (never negative) and `shortage`. Products without stock control have `null` balances and never block. `shortages` lists the stock-controlled items that are not produced internally; `production` lists the produced aggregates with `toProduce`, `canProduce` and `missingIngredients`; `feasible` is `true` only when `shortages` is empty. A stock-controlled item without a stock entry is reported as `MISSING_SCENARIO_STOCK` or `MISSING_STOCK` instead of being treated as 0.
6. **Warnings never block** (`PIZZA_STOCK_IGNORED`, `UNMEASURED_NON_STOCK_COMPONENT` of a simple component, and the other non-blocking issues of the snapshot).

### Positive Consequences

* An aggregate and its ingredients are never counted twice: the ingredients only carry the part of the demand that the stock of the aggregate did not cover.
* Cycles are impossible by construction, and inconsistent compositions are rejected both when they are saved and when they are calculated.
* The result explains every quantity (direct and derived demand, stock used, remaining, shortage), so the demonstration scenarios have exact expected values.

### Negative Consequences

* Only one level of aggregation: an aggregate cannot contain another aggregate (for example a sauce made from a produced base). Supporting it would require a recursive expansion and cycle detection.
* The calculation does not compute purchase quantities, lot sizes or costs; replenishment needs are shortages in stock units (purchases are in the requirements planning of AI02/AI05).

## Pros and Cons of the Options

### Separate recursive `Recipe` aggregate

* Good, because it supports any depth of composition.
* Bad, because it needs cycle detection, a new lifecycle and endpoints, and a recursive expansion that is harder to explain and test.

### `aggregate` value object of `Product`, one level, stock first

* Good, because the classification and the composition stay with the product that is stored and counted in stock, and the rules are simple to validate and explain.
* Bad, because it limits the depth to one level.

### Expand every aggregate and ignore its stock

* Good, because it is the simplest calculation.
* Bad, because it ignores aggregates already in stock and counts ingredients that are not needed, which AI01 explicitly forbids.
