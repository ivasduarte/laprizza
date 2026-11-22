# Requirements Planning with Chronological Net Needs and the Cheapest On-Time Supplier

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-22

Technical Story: [AI02] Prolog Requirements Planning and Supplier Selection

## Context and Problem Statement

AI02 asks for a daily replenishment plan for a forecast period. The forecast gives the daily consumption of sellable products (pizzas with a size, and directly sold products); the BOM of AI01 turns it into material needs; the stock covers part of them; and a confirmed supplier scenario offers each product at a price in EUR for a number of stock units, with a lead time in days and an optional supply limit. The plan must say what to buy, from whom, when it arrives and what stays uncovered, and the selection criteria (cost and delivery timing) must be documented and justified. How should the needs be dated, and how should the offers be chosen?

## Decision Drivers

* A need is only useful if it is met in time: AI02 treats a daily requirement as due at the start of its day and asks for late or unmet requirements to be reported.
* Cost matters among the offers that meet the date. Offers quote different pack sizes, so prices must be compared on a common stock-unit basis.
* Missing capacity information must not be read as zero nor as verified unlimited availability.
* No double counting with the aggregates of AI01, and no change to stored stock.
* Deterministic and explainable results, with fixed expected values in the tests.

## Considered Options

* Net needs per day with stock consumed chronologically, then a two-pass greedy allocation: cheapest on-time offer first, then the earliest arrival for what is left
* One purchase per product for the whole period from the cheapest offer, regardless of the dates
* An optimization model (linear programming) that minimizes the total cost under date and capacity constraints

## Decision Outcome

Chosen option: "Net needs per day with stock consumed chronologically, then a two-pass greedy allocation", implemented in `ai-scheduling/requirements.pl` (`requirements_calculate/2,3`).

1. **Gross demand per day.** A forecast line with a size is a pizza and is expanded through its BOM (`bom_item/4`); a line without a size is the direct demand of the product, one stock unit per unit sold.
2. **Produced aggregates.** Their stock is used first and only the rest is produced; the quantities produced each day are expanded into their ingredients (as in [ADR-0040](./0040-product-aggregates-and-stock-first-bom-expansion.md)). A produced aggregate is never bought.
3. **Net need per day (`net_series/3`).** The stock is consumed in date order: the need of a day is what the cumulative demand exceeds the stock by, minus what was already short on earlier days. Planned deliveries and hypothetical balances are results only.
4. **Reference date.** Purchases are placed on the reference date, the day of `meta.retrievedAt` of the snapshot (the execution date), or the `today(Date)` option of `requirements_calculate/3` for historical simulations; it is returned as `plan.referenceDate`. An offer arrives `ceiling(leadTimeDays)` calendar days later and is on time when it arrives on or before the day of the need.
5. **Unit price.** `unitPriceEur = priceEur / stockUnits`. The cost of an allocation is the unit price times the quantity, pro rata: no rounding to whole offers and no minimum order.
6. **Capacity.** `supplyLimit`, when present, is the total a supplier can deliver of the product over the whole plan (`0` means no capacity). Without it the capacity is not verified: it is taken as unbounded and every such allocation carries `capacityStated: false`.
7. **Pass 1, on time.** Needs in date order; each takes the cheapest offer that arrives on time, ties broken by the earliest arrival and then the supplier id, until the need is covered or no on-time capacity is left.
8. **Pass 2, late.** The needs still open take the capacity left, earliest arrival first and then the cheapest; these allocations carry `onTime: false`.
9. **Status and unmet needs.** Each product is `on_time`, `late`, `partial` or `unavailable`; the uncovered quantities are listed in `unmet` with `NO_SUPPLIER_OFFER` or `INSUFFICIENT_SUPPLY`. `summary.feasible` is `true` only when every product is `on_time`.

### Positive Consequences

* The delivery date is a hard criterion and cost only decides among the offers that meet it, which matches how a missing ingredient stops production.
* Serving the earliest need first is also the cheapest order: an offer that is on time for an earlier need is also on time for every later one, so the later needs always have at least the same choice of offers.
* Pass 2 only uses capacity that pass 1 did not need, so a late delivery never takes the place of an on-time one.
* Every quantity, price and date can be traced and recomputed by hand; the tests in `test/requirements.plt` assert them.

### Negative Consequences

* The greedy allocation is not a global optimum when supply limits interact across several products or suppliers; it is optimal for one product with the rules above.
* Costs are pro rata: a supplier that only sells whole packs or has a minimum order would cost more than planned.
* Every purchase is placed on the reference date; the plan does not delay orders to the latest possible day.
* Units are not compared: every product uses one abstract stock unit (`stockUnit: "abstract stock unit"` in the product export), so incompatible units cannot occur with the current data and are not flagged.

## Pros and Cons of the Options

### Chronological net needs and two-pass greedy allocation

* Good, because it meets the dates first, minimizes cost among on-time offers, is deterministic and easy to explain.
* Bad, because it is not globally optimal across products with shared supplier limits.

### One purchase per product from the cheapest offer

* Good, because it is the simplest plan.
* Bad, because it ignores the lead times and the daily dates, so it can propose deliveries that arrive after the need.

### Linear programming

* Good, because it can minimize the total cost under all constraints.
* Bad, because it needs a solver outside the Prolog service, and its results are harder to explain and to check by hand for the demonstration.
