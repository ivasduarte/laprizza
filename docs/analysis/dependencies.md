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

***Note:** No User Story from Sprint 1 depends on others from future sprints. The dependency is inverted.*

## Aggregate Level Dependencies
According to the project's Domain Model, the aggregate dependencies are represented by the following graph. It uses structural dependency arrows (`-.->`) to indicate high-level reliance between modules.

![Aggregate Dependencies](./diagrams/aggregate-dependencies.svg)

**Graph Clarification:**

- `Users` is the most independent aggregate of the system, not depending on any business concepts.
- `Stock` and `Kitchen` are not dependent on any other aggregates.
- `Customers` depends on `Products` as this may maintain information about `DietaryRestriction`.
- `Orders` depends on everything that is set to be implemented in **Sprint 1**.