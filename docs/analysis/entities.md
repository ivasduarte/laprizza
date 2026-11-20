# Entities

This document justifies the classification of domain concepts within the **LaPrizza** system into **Domain-Driven Design (DDD)** categories based on the provided specifications.

## Aggregate Roots and Entities

* **User and Customer**
    * Each `User` must have a unique identifier.
    * `Customer` acts as an **AggregateRoot** because the system needs to support the creation and update of customers, with them also having a unique identification independent of the user profile.
* **Product**
    * Serves as an **AggregateRoot** because the system must support the independent creation and update of product records.
* **ProductCategory**
    * It is an **AggregateRoot** because the system must maintain a catalogue of Product Categories, and these categories are searchable using relevant identifying information.
* **Allergen**
    * It acts as an **AggregateRoot** because the system must maintain an independent catalogue of allergens.
* **PizzaSize**
    * It is modeled as an **AggregateRoot** because the system must maintain the Pizza Sizes recognized by LaPrizza independently of the pizzas themselves.
* **PizzaComponentType**
    * It is an **AggregateRoot** because the set of Pizza Component Types and their properties must be independently configurable.
* **PredefinedPizza**
    * It acts as an **AggregateRoot** because it defines a default pizza configuration composed of products, essentially wrapping a specific business configuration with an independent lifecycle.
* **StockInformation**
    * It acts as an **Entity** inside the Product aggregate because it holds mutable state, and the system must provide operations for increasing or decreasing the current stock quantity.
    * It requires strict lifecycle and state validation since a stock reduction must not result in a negative stock quantity.
* **Order**
    * It acts as an **AggregateRoot** to manage the overall progression through different stages of the restaurant's operational process.
* **OrderItem**
    * It is an **Entity** within the `Order` Aggregate Root because its state may also reflect the progress of individual items tied to the parent order.
* **KitchenResource**
    * It is an **AggregateRoot** because it possesses a distinct identity, and the system must manage its availability and capacity.
* **PreparationActivity**
    * It acts as an **Entity** because preparation activities may depend on the completion of other activities, necessitating independent state tracking.
* **AuthSession**
    * It is an **AggregateRoot** because a session has its own lifecycle (created at login, renewed, revoked at logout or on expiry) that is independent of the `User` it belongs to.
* **PasswordResetToken**
    * It is an **AggregateRoot** because each password recovery request is a time-limited, single-use process with its own lifecycle, separate from the `User`.
* **KitchenConfiguration**
    * It is an **AggregateRoot** because each configuration has a unique identifier, a name, its own content, and an active or inactive status, and exactly one configuration is active at a time.
* **AssemblyLineConfiguration**
    * It is an **AggregateRoot** because a line definition is reusable across kitchen configurations and is managed independently of them; it has no active state of its own.
* **Forecast**
    * It is an **AggregateRoot** because forecasts are created, consulted, and deactivated independently. Each saved version is immutable, so earlier planning results keep their meaning.
* **SupplierScenario**
    * It is an **AggregateRoot** because each imported set of suppliers and offers is confirmed, versioned, and deactivated as a whole.
* **Supplier**
    * It is an **Entity** within the `SupplierScenario` aggregate because it has an identifier that is unique within the scenario and is referenced by the offers.
* **ScenarioProduct**
    * It is an **Entity** within the `SupplierScenario` aggregate because it groups, for one product of the system, all the offers of the scenario; each product appears only once.
* **PlanningRun**
    * It is an **AggregateRoot** because each successful planning calculation is recorded with its own identity and can be consulted later; it is append-only.

## Value Objects

* **Role**
    * It acts as a **ValueObject** in this model because it is defined solely by its `name` attribute and does not require a complex independent lifecycle.
* **Address**
    * It is a **ValueObject** because it represents attributes related to a location, lacking an identity outside the context of a `Customer`.
* **DietaryRestriction**
    * It is a **ValueObject** because it only acts as a descriptor of a restriction bound to a certain customer.
* **ComponentSizeConfiguration**
    * It is classified as a **ValueObject** because it contains no unique identity and purely encapsulates the data that maps a component to a specific size.
* **PizzaConfiguration**
    * It functions as a **ValueObject** because it represents a specific group of selected components and sizes at a given moment in time.
* **ExternalIdentity**
    * It is a **ValueObject** of the `User` aggregate because it is defined by its `issuer` and `subject` (the identity at an external provider) and has no lifecycle of its own. It is persisted in its own collection only to enforce, in the database, that the same external identity cannot belong to two users.
* **Aggregate**
    * It is a **ValueObject** of the `Product` aggregate because it only describes the composition and the classification (produced or purchased) of that product.
* **AggregateItem**
    * It is a **ValueObject** because it is defined only by the product it refers to and its quantity.
* **ForecastEntry**
    * It is a **ValueObject** because it is defined by its date, product, size, and quantity, and has no meaning outside its `Forecast`.
* **Offer**
    * It is a **ValueObject** because it is defined only by its supplier, price, stock units, lead time, and optional supply limit.
* **PlanningRequest**
    * It is a **ValueObject** because it only records the parameters with which a `PlanningRun` was requested.
* **InputVersion**
    * It is a **ValueObject** because it only records the identifier, name, and version of a forecast or supplier scenario used by a `PlanningRun`.
