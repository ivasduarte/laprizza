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