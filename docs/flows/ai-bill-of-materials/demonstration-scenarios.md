# AI01 - Demonstration Scenarios: Initial Data and Expected Results

The demonstration uses the data of the AI01 seed (`backend/seed/ai01-demo.json`), loaded with:

```bash
cd backend
npm run seed:ai01-demo -- --confirm
```

The seed writes nothing without `--confirm`, never overwrites a document that is not a demonstration document, and restores the demonstration data to the values below every time it runs. Running it again is how the scenarios and the real stock of the `[Demo]` products are reset ([ADR-0041](../../adr/0041-simulated-bom-scenarios-with-selectable-stock-and-a-resettable-demo-seed.md)). All the documents use fixed ids (`de01…`) and names with the prefix `[Demo] `.

The main expected values below are checked automatically: against the seeded data by `backend/test-flows/bom-demo-test-flow.http`, and against the same data as fixtures by the Prolog tests (`ai-scheduling/test/bom.plt`, `ai-scheduling/fixtures/demo-*.json`). The integration test `ai01.integration.test.js` checks that the snapshot built from the seed matches the fixture. All quantities are in abstract stock units.

## 1. Initial data

### Sizes and pizzas

Sizes `[Demo] S`, `[Demo] M` and `[Demo] L`. Every pizza is a predefined pizza available in the three sizes.

| Pizza | Components |
|---|---|
| `[Demo] Margherita` | Massa, Molho, Mozzarella |
| `[Demo] Prosciutto e Funghi` | Massa, Molho, Mozzarella, Fiambre, Cogumelos |
| `[Demo] Funghi Simples` | Base pronta, Mozzarella, Cogumelos, Orégãos |

### Components, consumption per size and aggregates

| Product | Stock control | S | M | L | Aggregate |
|---|---|---|---|---|---|
| Massa (dough) | yes | 1 | 1 | 2 | **Produced**: Farinha × 2, Água × 1, Fermento × 1 |
| Molho (sauce) | yes | 1 | 1 | 2 | **Purchased** (no composition) |
| Mozzarella | yes | 1 | 2 | 3 | - |
| Fiambre (ham) | yes | 1 | 1 | 2 | - |
| Cogumelos (mushrooms) | yes | 1 | 1 | 2 | - |
| Base pronta (ready base) | yes | 1 | 1 | 2 | - (simple product, bought ready) |
| Orégãos (oregano) | no | - | - | - | - (no consumption defined) |
| Farinha, Água, Fermento (flour, water, yeast) | no | - | - | - | Items of Massa |

Farinha, Água and Fermento have no stock control: the calculation reports how much is needed, with `available`, `used`, `remaining` and `shortage` set to `null`, and they never block. Orégãos has no stock control and no consumption, so it is reported as the warning `UNMEASURED_NON_STOCK_COMPONENT` and not counted.

### Real stock (used in `live` mode)

| Massa | Molho | Mozzarella | Fiambre | Cogumelos | Base pronta |
|---|---|---|---|---|---|
| 0 | 2 | 5 | 4 | 1 | 5 |

### AI scenarios

All the scenarios have `version: 1`, `simulated: true` and their own stock (used in `scenario` mode).

| Scenario | Purpose | Simulated order | Stock of the scenario |
|---|---|---|---|
| `DEMO-BASIC` | Simple products only, enough stock | 3 × Funghi Simples M | Base pronta 5, Mozzarella 6, Cogumelos 4 |
| `DEMO-SUFFICIENT` | Aggregates fully in stock | 2 × Margherita M, 1 × Prosciutto e Funghi M | Massa 5, Molho 5, Mozzarella 10, Fiambre 3, Cogumelos 3 |
| `DEMO-INSUFFICIENT` | Shortages, and a produced aggregate with no stock | 2 × Prosciutto e Funghi L, 1 × Margherita M, 1 × Funghi Simples L | Massa 0, Molho 2, Mozzarella 5, Fiambre 4, Cogumelos 1, Base pronta 1 |
| `DEMO-PARTIAL` | An aggregate partly available in stock | 3 × Margherita M | Massa 1, Molho 5, Mozzarella 4 |

## 2. Expected results (`stockMode: "scenario"`)

Columns: required (direct + from aggregates), available, used, remaining, shortage. `-` means `null` (no stock control).

### DEMO-BASIC: `feasible: true`

| Item | Kind | Required | Available | Used | Remaining | Shortage |
|---|---|---|---|---|---|---|
| Base pronta | simple | 3 | 5 | 3 | 2 | 0 |
| Cogumelos | simple | 3 | 4 | 3 | 1 | 0 |
| Mozzarella | simple | 6 | 6 | 6 | 0 | 0 |

`shortages: []`, `production: []`. Warning `UNMEASURED_NON_STOCK_COMPONENT` for Orégãos (Funghi Simples, size M).

### DEMO-SUFFICIENT: `feasible: true`

| Item | Kind | Required | Available | Used | Remaining | Shortage |
|---|---|---|---|---|---|---|
| Massa | produced aggregate | 3 | 5 | 3 | 2 | 0 (`toProduce: 0`) |
| Molho | purchased aggregate | 3 | 5 | 3 | 2 | 0 |
| Cogumelos | simple | 1 | 3 | 1 | 2 | 0 |
| Fiambre | simple | 1 | 3 | 1 | 2 | 0 |
| Mozzarella | simple | 6 | 10 | 6 | 4 | 0 |

The dough comes from stock, so it is not produced and its ingredients (Farinha, Água, Fermento) do not appear.

### DEMO-INSUFFICIENT: `feasible: false`

| Item | Kind | Required | Available | Used | Remaining | Shortage |
|---|---|---|---|---|---|---|
| Massa | produced aggregate | 5 | 0 | 0 | 0 | 5 (`toProduce: 5`) |
| Molho | purchased aggregate | 5 | 2 | 2 | 0 | 3 |
| Base pronta | simple | 2 | 1 | 1 | 0 | 1 |
| Cogumelos | simple | 6 | 1 | 1 | 0 | 5 |
| Fiambre | simple | 4 | 4 | 4 | 0 | 0 |
| Mozzarella | simple | 11 | 5 | 5 | 0 | 6 |
| Farinha | simple | 10 (0 + 10) | - | - | - | - |
| Água | simple | 5 (0 + 5) | - | - | - | - |
| Fermento | simple | 5 (0 + 5) | - | - | - | - |

* `shortages` (replenishment needs): Molho 3, Mozzarella 6, Cogumelos 5, Base pronta 1. The purchased sauce is replenished directly; it is never expanded.
* `production`: Massa `toProduce: 5`, `canProduce: true` (its ingredients have no stock control, so they never block).
* Warning `UNMEASURED_NON_STOCK_COMPONENT` for Orégãos (Funghi Simples, size L).

### DEMO-PARTIAL: `feasible: false` (aggregate partly in stock)

| Item | Kind | Required | Available | Used | Remaining | Shortage |
|---|---|---|---|---|---|---|
| Massa | produced aggregate | 3 | 1 | 1 | 0 | 2 (`toProduce: 2`) |
| Molho | purchased aggregate | 3 | 5 | 3 | 2 | 0 |
| Mozzarella | simple | 6 | 4 | 4 | 0 | 2 |
| Farinha | simple | 4 (0 + 4) | - | - | - | - |
| Água | simple | 2 (0 + 2) | - | - | - | - |
| Fermento | simple | 2 (0 + 2) | - | - | - | - |

* `shortages`: Mozzarella 2. `production`: Massa `toProduce: 2`, `canProduce: true`.
* **No double counting.** 3 Margherita M need 3 doughs. The one dough in stock is used first; only the **2** missing doughs are expanded, so Farinha is 2 × 2 = **4** and not 3 × 2 = 6.
* The remaining stock is never negative: Mozzarella has remaining 0 and shortage 2, never −2.

## 3. Expected result of `DEMO-PARTIAL` with `stockMode: "live"`

The same order, with the real stock of the `[Demo]` products (as written by the seed):

| Item | Required | Available | Used | Remaining | Shortage |
|---|---|---|---|---|---|
| Massa | 3 | 0 | 0 | 0 | 3 (`toProduce: 3`) |
| Molho | 3 | 2 | 2 | 0 | 1 |
| Mozzarella | 6 | 5 | 5 | 0 | 1 |
| Farinha / Água / Fermento | 6 / 3 / 3 | - | - | - | - |

`shortages`: Molho 1, Mozzarella 1. `inputs.sources.stock.source: "backend-live"`. These values change if the real stock of the `[Demo]` products is changed; running the seed restores them.

## 4. Stock is never changed

The flow reads the real stock of the six `[Demo]` stock-controlled products before and after the `live` calculation and checks that it is the same. The stock of the scenarios is only read. Every result has `simulation: true`.

## 5. Reference example of the requirements

The example of the AI01 statement (3 Margherita M, with stock Massa 1, Molho 5, Mozzarella 4) is `DEMO-PARTIAL`. In the statement the ingredients are also stock-controlled (Farinha 3, Água 10, Fermento 10), so it also reports a shortage of 1 Farinha (4 needed, 3 available), and the dough has `canProduce: false` with Farinha in `missingIngredients`. In the seed the ingredients have no stock control, so the same 4 / 2 / 2 are reported as required without a balance. The Prolog tests cover both cases (`ai-scheduling/test/bom.plt`).
