# Relationships

This document documents and justifies every relationship represented in the Domain Model. 
All information was extracted from the business rules present in **PART II - SYSTEM SPECIFICATION** and acceptance criteria detailed in **PART III - SPRINT 1 - USER STORIES**.

## 1. Users
### 1.1. `User` *(has, 1..\*)* `Role`
> **PART II, II.3.1:** "Users can therefore be identified within the system and assigned appropriate roles that determine the operations they are authorized to perform."
> **PART III, BCK01:** "The system must support the roles required to distinguish the responsibilities and permitted operations of different users."
- **Justification:** A user may have more than one role, and the same role can be applied to different users.
- **Multiplicity:** `1..*` from `Role` guarantees a `User` has at least one role, making it consistent with the official document.

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