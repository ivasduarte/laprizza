# Relationships

This document documents and justifies every relationship represented in the Domain Model. 
All information was extracted from the business rules present in **PART II - SYSTEM SPECIFICATION** and acceptance criteria detailed in **PART III - SPRINT 1 - USER STORIES** and **PART IV - SPRINT 2 - USER STORIES** (page numbers refer to the Sprint 2 User Stories document).

## 1. Users
### 1.1. `User` *(has, 1..\*)* `Role`
> **PART II, II.3.1:** "Users can therefore be identified within the system and assigned appropriate roles that determine the operations they are authorized to perform."
> **PART III, BCK01:** "The system must support the roles required to distinguish the responsibilities and permitted operations of different users."
- **Justification:** A user may have more than one role, and the same role can be applied to different users.
- **Multiplicity:** `1..*` from `Role` guarantees a `User` has at least one role, making it consistent with the official document.


### 1.2. `User` *(signs in with, 0..\*)* `ExternalIdentity`
> **PART IV, AA02:** "External authentication must establish a verified identity before protected application functionality becomes available."
> **PART IV, AA03:** "Every newly created internal account must automatically receive the Customer role, whether created for local authentication or for a verified external identity."
- **Justification:** A user may sign in with a local password, with one or more external providers, or with both. `ExternalIdentity` has no meaning without its `User` (Composition) and is identified by the pair `(issuer, subject)` issued by the provider, not by the e-mail.
- **Multiplicity:** `0..*`, because a local-only user has none. A user has at most one identity per provider, and an identity belongs to exactly one user.

### 1.3. `AuthSession` *(belongs to, 1)* `User`
> **PART IV, AA04 (p. 9):** "The authenticated session must be maintained securely while the user works in the application."
> **PART IV, AA04 (p. 10):** "Logout must prevent the ended session from being reused to perform protected operations."
- **Justification:** A session is created at login, renewed, and revoked at logout independently of the `User`, so it is its own aggregate that references the user ([ADR-0011](../adr/0011-implement-refresh-tokens-for-secure-sessions.md), [ADR-0032](../adr/0032-secure-session-handling-in-the-api-and-the-spa.md)).
- **Multiplicity:** `*` to `1`, because a user may be signed in on several devices, and each session belongs to exactly one user.

### 1.4. `PasswordResetToken` *(resets password of, 1)* `User`
> **PART IV, AA01 (p. 8):** "Password recovery must use a time-limited, single-use process that verifies control of the intended account."
- **Justification:** Each recovery request creates a time-limited, single-use token for one account; it is consumed or expires without changing the `User` aggregate until the password is reset.
- **Multiplicity:** `*` to `1`, because a user may request recovery more than once, and each token is issued for exactly one user.

## 2. Customers
### 2.1. `Customer` *(places, 0..\*)* `Order`
> **PART II, II.3.1.5:** "Customers interact with LaPrizza primarily by placing orders."
- **Justification:** A client is not obliged to place a single order; they can place multiple orders if intended.

### 2.2. `Customer` *(has, 0..\*)* `Address`
> **PART II, II.3.1.1:** "Customer information may include [...], as well as one or more addresses associated with a customer."
- **Justification:** `Address` does not have an identity outside the client, making the relationship a **composition**: the address only exists while it is related to a `Customer`.
- **Multiplicity:** `1..*` is used as customers must always have at least one address related to them.

### 2.3. `Customer` *(records, 0..\*)* `DietaryRestriction`
> **PART II, II.3.1.1:** "Customers may provide information concerning known food intolerances or other relevant dietary restrictions."
- **Justification:** Just like `Address`, `DietaryRestriction` has no meaning outside the specific customer context (Composition).
- **Multiplicity:** `0..*` as not all customers may have dietary restrictions, but one can have multiple.

## 3. Product
### 3.1. `Product` *(classified by, 1)* `ProductCategory`
> **PART II, II.3.1.2:** "Products may be organized into categories..."
> **PART III, BCK05:** "A product must be associable with an appropriate Product Category."
- **Justification:** As stated in BCK05, a `Product` must be related to exactly one category.

### 3.2. `Product` *(may contain, 1..\*)* `Allergen`
> **PART II, II.3.1.2:** "Products must contain or be associated with one or more allergens."
- **Justification:** A `Product` must relate to at least one `Allergen` (or none if strictly 0..*, but rule implies safety tracking).

### 3.3. `Product` *(may maintain, 0..1)* `StockInformation`
> **PART II, II.3.1.4:** "Some products may additionally be subject to stock control."
- **Justification:** Only products subject to stock control will have `StockInformation`.

### 3.4. `Product` *(component role, 0..1)* `PizzaComponentType`
> **PART II, II.3.1.3:** "When a product is designated for use as a pizza component, it is associated with exactly one Pizza Component Type."
- **Justification:** A `Product` may be a pizza component, but it is not mandatory.

### 3.5. `Product` *(is an aggregate, 0..1)* `Aggregate`
> **PART IV, AI06 (p. 18):** "For each pizza and applicable size, include products, aggregates, quantities in abstract stock units, and the aggregate composition and production-or-purchase classification needed for expansion."
> **PART IV, WEB07 (p. 7):** "Include raw materials, purchased aggregates, and directly sold stock-controlled products needed for planning."
- **Justification:** Some products (for example a dough or a sauce) are made of other products. The composition has no identity outside its `Product` (Composition), and its classification states whether it is produced internally or purchased.
- **Multiplicity:** `0..1`, because most products are not aggregates.

### 3.6. `Aggregate` *(composed of, 0..\*)* `AggregateItem`
> **PART IV, AI01 (p. 16):** "Use the back-end production-or-purchase classification and avoid counting both an aggregate and the ingredients already represented by it."
- **Justification:** Each item states how much of another product the aggregate contains (Composition).
- **Multiplicity:** `0..*`, because a produced aggregate must have items, while a purchased aggregate has none (domain rules `AGGREGATE_PRODUCED_WITHOUT_ITEMS` and `AGGREGATE_PURCHASED_WITH_ITEMS`).

### 3.7. `AggregateItem` *(item, 1)* `Product`
> **PART IV, AI06 (p. 18):** "For each pizza and applicable size, include products, aggregates, quantities in abstract stock units, and the aggregate composition and production-or-purchase classification needed for expansion."
- **Justification:** Every item of an aggregate refers to exactly one existing product.

## 4. Pizza
### 4.1. `ComponentSizeConfiguration` *(for, 1)* `PizzaSize`
> **PART II, II.3.1.3:** "Such a configuration associates a product designated as a pizza component with a particular Pizza Size."
- **Justification:** A pizza component configuration is dependent on the pizza size.

### 4.2. `PizzaConfiguration` *(composed of, 0..\*)* `Product`
> **PART III, BCK10:** "A Predefined Pizza must define a default pizza configuration composed of products designated as Pizza Components."
- **Justification:** The configuration of a predefined pizza must include those products (Composition).

### 4.3. `PredefinedPizza` *(represented by, 1)* `Product`
> **PART III, BCK10:** "A Predefined Pizza must be represented by an appropriate sellable product."
- **Justification:** A `PredefinedPizza` must tie back to a sellable catalogue product.

### 4.4. `PredefinedPizza` *(defaultConfiguration, 1)* `PizzaConfiguration`
> **PART II, II.3.1.3:** "A predefined pizza [...] defines an initial selection of pizza components."
- **Justification:** To define the components present in the available default pizza, we need to set its configuration (Composition).

### 4.5. `PizzaConfiguration` *(originatedFrom, 0..1)* `PredefinedPizza`
> **PART II, II.3.1.3:** "Such a configuration [personalized pizza] may retain a reference to the predefined pizza from which it originated..."
- **Justification:** A personalized pizza may be created from a change in the configuration of a predefined one (Dependency).

## 5. Orders
### 5.1. `Order` *(contains, 1..\*)* `OrderItem`
> **PART II, II.3.1.5:** "An order consists of one or more Order Items..."
- **Justification:** For an order to be made, at least one item must be requested by the customer (Composition).

### 5.2. `OrderItem` *(catalogue product, 0..1)* `Product`
> **PART II, II.3.1.5:** "An order item may correspond directly to a sellable product from the LaPrizza catalogue."

### 5.3. `OrderItem` *(preserved configuration, 0..1)* `PizzaConfiguration`
> **PART II, II.3.1.5:** "[...] the order item may instead preserve the particular pizza configuration selected by the customer."
- **Justification:** When an order item is not a direct sellable product, it may be a personalized pizza maintaining an exact snapshot of the configuration (Composition).

### 5.4. `OrderItem` *(may require, 1..\*)* `PreparationActivity`
> **PART II, II.3.1.6:** "Depending on the item ordered, fulfilling an order may involve one or more Preparation Activities."

## 6. Kitchen
### 6.1. `PreparationActivity` *(uses, 0..\*)* `KitchenResource`
> **PART II, II.3.1.6:** "They [preparation activities] may also require access to limited Kitchen Resources such as preparation stations and ovens."

### 6.2. `PreparationActivity` *(dependsOn, 0..\*)* `PreparationActivity`
> **PART II, II.3.1.6:** "Preparation activities may depend on the completion of other activities, thereby establishing sequencing constraints within the preparation process."
- **Justification:** Represents the workflow sequence for meal assembly (Dependency).

### 6.3. `KitchenConfiguration` *(places line, 0..1)* `AssemblyLineConfiguration`
> **PART IV, WEB06 (p. 6):** "It must include kitchen dimensions and the placement, orientation, and scale of equipment and assembly-line elements."
> **PART IV, WEB06 (p. 6):** "The JSON format must be documented and include the model references and visual properties required by the VIS User Stories, either directly or through resolvable back-end references."
- **Justification:** The kitchen configuration places a reusable assembly line definition through a reference, so only the kitchen configuration has an active state ([ADR-0031](../adr/0031-assembly-line-referenced-by-kitchen.md)).
- **Multiplicity:** `0..1`, because the placement is optional so that existing configurations stay valid; the same line may be placed by several kitchen configurations, and it cannot be deleted while referenced.

## 7. Forecasts
### 7.1. `Forecast` *(entries, 1..\*)* `ForecastEntry`
> **PART IV, WEB07 (p. 6):** "Each forecast must have an identifier, name, start and end dates, and daily quantities of sellable products, including pizzas."
- **Justification:** An entry has no meaning outside its forecast (Composition).
- **Multiplicity:** `1..*`, because a forecast without entries is rejected (rule `noEntries`); omitted entries mean zero consumption.

### 7.2. `ForecastEntry` *(product, 1)* `Product` and *(size, 0..1)* `PizzaSize`
> **PART IV, WEB07 (pp. 6-7):** "Each entry identifies the date, product, applicable size, and a non-negative integer quantity."
> **PART IV, WEB07 (p. 7):** "Reject unknown products, incompatible sizes, dates outside the period, and duplicate date/product/size entries."
- **Justification:** Every entry refers to one sellable product; the size is required only when the product is a pizza.
- **Multiplicity:** `0..1` for `PizzaSize`, because products that are not pizzas have no size.

## 8. Supplier Scenarios
### 8.1. `SupplierScenario` *(suppliers, 0..\*)* `Supplier` and *(products, 0..\*)* `ScenarioProduct`
> **PART IV, WEB07 (p. 7):** "It must contain two lists: suppliers with unique identifiers (names optional), and products with existing system identifiers and a list of supplier offers for each product."
- **Justification:** Suppliers and products only exist inside the imported scenario (Composition). Scenarios are immutable and versioned ([ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md)).

### 8.2. `ScenarioProduct` *(product, 1)* `Product`
> **PART IV, WEB07 (p. 7):** "It must contain two lists: suppliers with unique identifiers (names optional), and products with existing system identifiers and a list of supplier offers for each product."
- **Justification:** Each product of the scenario refers to exactly one existing product of the system.

### 8.3. `ScenarioProduct` *(offers, 0..\*)* `Offer`
> **PART IV, WEB07 (p. 7):** "Products without offers must remain visible as having no configured supplier."
- **Justification:** The offers have no meaning outside the product of the scenario (Composition).
- **Multiplicity:** `0..*`, because an empty list means the product has no configured supplier.

### 8.4. `Offer` *(sold by, 1)* `Supplier`
> **PART IV, WEB07 (p. 7):** "Each offer must identify a listed supplier and specify its selling price in euros (EUR), the positive integer number of abstract stock units covered by that price, and the delivery lead time in days from order placement."
- **Justification:** Every offer refers to one supplier listed in the same scenario, with at most one offer per supplier and product.

## 9. Planning
### 9.1. `PlanningRun` *(request, 1)* `PlanningRequest` and *(forecast, supplierScenario, 0..2)* `InputVersion`
> **PART IV, WEB07 (p. 7):** "Associate each result with the forecast version, stock snapshot, pizza BOM, and supplier scenario used."
- **Justification:** The request and the versions of the inputs used have no meaning outside the run (Composition) ([ADR-0034](../adr/0034-recording-planning-runs-with-their-input-versions.md)).
- **Multiplicity:** `0..2` for `InputVersion`: one for the forecast and one for the supplier scenario, each only when used.

### 9.2. `PlanningRun` *(used, 0..1)* `Forecast` and `SupplierScenario`
> **PART IV, WEB07 (p. 7):** "Editing a forecast must not change the meaning of earlier results."
- **Justification:** The run keeps the identifier, name, and version of each input instead of a live reference, so later versions or deactivations do not change its meaning (Dependency).

### 9.3. `PlanningRun` *(requested by, 0..1)* `User`
> **PART IV, WEB07 (p. 6):** "Provide a Manager-only SPA page to create, view, edit, and delete consumption forecasts stored in the back end."
- **Justification:** Each run records the Manager who requested it.
- **Multiplicity:** `0..1`, because the requester is recorded only when known.
