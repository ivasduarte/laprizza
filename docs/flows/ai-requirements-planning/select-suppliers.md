# AI02 UC2 - Select Suppliers

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | AI Scheduling Module |
| Entry point | `purchase_entry/3` (`requirements.pl`), called by `calculate/4` for every product with net needs, inside `requirements_calculate/2,3` ([UC1](./calculate-requirements-planning.md)) |
| Allowed callers | `POST /requirements` (Manager token, pull) and `POST /service/requirements` (`X-Api-Key`, push, [WEB07 UC9](../ai-planning/execute-forecast.md)) |
| Success response | n/a (part of the 200 result of UC1): `purchases[]` and `summary` |
| Error handling | No error of its own. A product without offers is `unavailable` with `unmet` reason `NO_SUPPLIER_OFFER`; capacity exhausted gives `partial` or `unavailable` with `INSUFFICIENT_SUPPLY`; without a supplier scenario every product is `unavailable` and the result has the warning `NO_SUPPLIER_SCENARIO` |
| ADRs | [ADR-0058](../../adr/0058-requirements-planning-with-chronological-net-needs-and-on-time-cheapest-supplier.md) |

## Description

The supplier selection runs on the facts of the confirmed supplier scenario carried by the snapshot: `supplier_offer(Supplier, Product, PriceEur, StockUnits, LeadTimeDays)` and, only when the offer states it, `supplier_limit(Supplier, Product, Limit)`. Its input is the list of net needs of one product, `[Date-Units]` in date order, from UC1.

1. **Offers of the product (`offers_state/3`).** For each offer: `unitPriceEur = priceEur / stockUnits` (the common stock-unit basis), the arrival date `referenceDate + ceiling(leadTimeDays)` calendar days, and the capacity: the supply limit for the whole plan, or `unbounded` when the offer has none. Offers of other products are never used.
2. **Pass 1, on time (`allocate_pass(on_time, ...)`).** Needs are served in date order. Each need takes the offer with capacity that arrives on or before its day, choosing the lowest unit price, then the earliest arrival, then the supplier id (`offer_key/5`), until the need is covered or no on-time capacity is left. The capacity taken is subtracted from the offer, so a limit is cumulative over the whole plan.
3. **Pass 2, late (`allocate_pass(late, ...)`).** The needs still open take the capacity left after pass 1, choosing the earliest arrival, then the lowest unit price. Pass 2 only sees what pass 1 did not use, so a late delivery never takes the capacity an on-time need received.
4. **Purchase entry.** Each allocation becomes `{ supplierId, supplierName, forDate, quantity, unitPriceEur, costEur, arrivalDate, onTime, capacityStated }` (`capacityStated: false` when the offer has no limit). What stays uncovered goes to `unmet[{ date, quantity, reason }]`: `NO_SUPPLIER_OFFER` when the product has no offer, `INSUFFICIENT_SUPPLY` otherwise. The status is `unavailable` (nothing covered), `partial` (part uncovered), `late` (covered, some lines late) or `on_time`. The cost of the product is the sum of its allocations, rounded to cents.
5. **Summary.** `totalCostEur` (sum of the products), `productsToBuy` and `feasible` (`true` only when every product is `on_time`).

All purchases are placed on `plan.referenceDate`. Nothing is written: the allocations are proposals of the plan, not purchase orders.

## Diagram

```mermaid
---
title: "AI02 UC2 - Select Suppliers - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor caller as Caller (back end or client)<br/>[Container / Person]
    box rgba(170,130,190,0.15) AI Scheduling Module [Container: SWI-Prolog]
        participant server as AI HTTP Server<br/>[Component: server.pl]
        participant kb as Knowledge Base<br/>[Component: kb.pl]
        participant req as Requirements Planning<br/>[Component: requirements.pl]
    end

    activate caller
    caller->>server: POST /requirements or POST /service/requirements
    activate server
    Note over server,kb: Snapshot received and loaded as facts, see UC1 and AI06 UC2
    server->>kb: with_snapshot(Snapshot, requirements_calculate(Request, Result))
    activate kb
    kb->>req: requirements_calculate(Request, Result)
    activate req
    req->>req: Validation, gross demand, production, net needs per day (UC1)
    loop Each stock-controlled product with net needs [Date-Units]
      req->>kb: supplier_offer(Sup, Product, PriceEur, StockUnits, LeadTimeDays), supplier_limit(Sup, Product, Limit)
      kb-->>req: Offers of the product (limit only when stated)
      req->>req: offers_state: unitPrice = priceEur / stockUnits, arrival = referenceDate + ceiling(leadTimeDays), capacity = limit or unbounded
      alt The product has no offer
        req->>req: Every need unmet, reason NO_SUPPLIER_OFFER, status "unavailable"
      else Offers exist
        loop Pass 1, needs in date order
          req->>req: pick(on_time): arrival <= need date, capacity left, lowest unit price, then earliest arrival, then supplier id
          req->>req: take_units: covered quantity, capacity reduced (limit cumulative over the plan)
        end
        loop Pass 2, needs still open
          req->>req: pick(late): capacity left, earliest arrival, then lowest unit price
          req->>req: take_units, line flagged onTime false
        end
        req->>req: Allocations (forDate, quantity, unitPriceEur, costEur, arrivalDate, onTime, capacityStated), unmet (INSUFFICIENT_SUPPLY)
        req->>req: purchase_status: unavailable, partial, late or on_time
      end
    end
    req->>req: summary: totalCostEur, productsToBuy, feasible (every product on_time)
    opt No supplier scenario in the snapshot
      req->>req: Warning NO_SUPPLIER_SCENARIO
    end
    req-->>kb: Result { plan (referenceDate), summary, requirements, production, purchases, warnings }
    deactivate req
    kb->>kb: clear_unlocked (the facts are always cleared)
    kb-->>server: Result
    deactivate kb
    server-->>caller: 200 OK (simulation true)
    deactivate server
    deactivate caller

    Note over req: Proposals only: no stock is changed and no purchase order is created.
```

See the [README](./README.md#supplier-selection-rules) for the selection rules, the worked example and the element catalogue.
