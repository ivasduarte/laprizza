# Dependencies

This document identifies and justifies the **class dependencies**, as required by User Story **ARC01**, as well as **aggregate dependencies**, required by User Story **ARC02**.

## Class Dependencies
A class needs to navigate through another to meet its responsibility. The following table maps the direct relationships within the Domain Model.

### Class Level Dependencies Table

| From                         | To                    | Nature           | Mandatory Direction?                        |
|------------------------------|-----------------------|------------------|---------------------------------------------|
| `User`                       | `Role`                | Composition      | Yes                                         |
| `Customer`                   | `Address`             | Composition      | Yes                                         |
| `Customer`                   | `DietaryRestriction`  | Composition      | Yes                                         |
| `Customer`                   | `Order`               | Association      | In future sprints                           |
| `DietaryRestriction`         | `Allergen`            | Association      | No                                          |
| `Product`                    | `ProductCategory`     | Association      | Yes                                         |
| `Product`                    | `Allergen`            | Association      | No                                          |
| `Product`                    | `StockInformation`    | Association      | No                                          |
| `Product`                    | `PizzaComponentType`  | Association      | No                                          |
| `ComponentSizeConfiguration` | `Product`             | Association      | Yes                                         |
| `ComponentSizeConfiguration` | `PizzaSize`           | Association      | Yes                                         |
| `PizzaConfiguration`         | `PredefinedPizza`     | Dependency       | No                                          |
| `PizzaConfiguration`         | `Product`             | Composition      | Yes                                         |
| `PredefinedPizza`            | `Product`             | Association      | Yes                                         |
| `PredefinedPizza`            | `PizzaConfiguration`  | Composition      | Yes                                         |
| `Order`                      | `Customer`            | Association      | Yes                                         |
| `Order`                      | `OrderItem`           | Composition      | Yes                                         |
| `OrderItem`                  | `Product`             | Association      | Conditional (XOR with `PizzaConfiguration`) |
| `OrderItem`                  | `PizzaConfiguration`  | Composition      | Conditional (XOR with `Product`)            |
| `OrderItem`                  | `PreparationActivity` | Association      | No                                          |
| `PreparationActivity`        | `KitchenResource`     | Association      | No                                          |
| `PreparationActivity`        | `PreparationActivity` | Dependency       | No                                          |
| `User`                       | `ExternalIdentity`    | Composition      | No                                          |
| `AuthSession`                | `User`                | Association      | Yes                                         |
| `PasswordResetToken`         | `User`                | Association      | Yes                                         |
| `Product`                    | `Aggregate`           | Composition      | No                                          |
| `Aggregate`                  | `AggregateItem`       | Composition      | Conditional (only when produced)            |
| `AggregateItem`              | `Product`             | Association      | Yes                                         |
| `KitchenConfiguration`       | `AssemblyLineConfiguration` | Association | No                                    |
| `Forecast`                   | `ForecastEntry`       | Composition      | Yes                                         |
| `ForecastEntry`              | `Product`             | Association      | Yes                                         |
| `ForecastEntry`              | `PizzaSize`           | Association      | Conditional (only for pizzas)               |
| `SupplierScenario`           | `Supplier`            | Composition      | No                                          |
| `SupplierScenario`           | `ScenarioProduct`     | Composition      | No                                          |
| `ScenarioProduct`            | `Product`             | Association      | Yes                                         |
| `ScenarioProduct`            | `Offer`               | Composition      | No                                          |
| `Offer`                      | `Supplier`            | Association      | Yes                                         |
| `PlanningRun`                | `PlanningRequest`     | Composition      | Yes                                         |
| `PlanningRun`                | `InputVersion`        | Composition      | No                                          |
| `PlanningRun`                | `Forecast`            | Dependency       | No                                          |
| `PlanningRun`                | `SupplierScenario`    | Dependency       | No                                          |
| `PlanningRun`                | `User`                | Association      | No                                          |

***Note:** No User Story from Sprint 1 depends on others from future sprints. The dependency is inverted.*

## Aggregate Level Dependencies
According to the project's Domain Model, the aggregate dependencies are represented by the following graph. It uses structural dependency arrows (`-.->`) to indicate high-level reliance between modules.

![Aggregate Dependencies](./diagrams/aggregate-dependencies.svg)

**Graph Clarification:**

- `Users` is the most independent aggregate of the system, not depending on any business concepts.
- `Stock` and `Kitchen` are not dependent on any other aggregates.
- `Customers` depends on `Products` as this may maintain information about `DietaryRestriction`.
- `Orders` depends on everything that is set to be implemented in **Sprint 1**.
- `Kitchen` also holds the kitchen and assembly line configurations; the kitchen configuration only references a line of the same module, so `Kitchen` still depends on no other module.
- `Forecasts` depends on `Products` (the product of each entry) and on `Pizza` (the applicable size).
- `Supplier Scenarios` depends on `Products`, because every offered product must exist in the system.
- `Planning` depends on `Forecasts` and `Supplier Scenarios` (the versions used by each run) and on `Users` (who requested the run).