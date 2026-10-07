# Domain Model - Relationship Justification

This document documents and justifies every relationship represented in ![Domain Model](docs/Sprint 1/svg/DM.svg). <br>
Every information was taken from the business rules present in **PART II - SYSTEM SPECIFICATION** and acceptance
criteria detailed in **PART III - SPRINT 1 - USER STORIES**.

---

### 1. Users

#### 1.1. `User` -(has, 1..*)-> `Role`

> **1. PART II, II.3.1.** <br>
> "Users can therefore be identified within the system and assigned approppriate roles that determine the operations
> they are authorized to perform"
> 
> **2. PART III, BCK01** <br>
> "the system must support the roles required to distinguish the responsibilities and 
> permitted operations of different users."

- **Justification:** An user may have more than one role, and the same role can be applied towards different users.
- **Multiplicity:** `1..*` from `Role` guarantees an `User` has at least one role, 
making it consistent with the official document.

--- 

### 2. Customers

#### 2.1. `Customer` -(places, 0..*)-> `Order`

> **1. PART II, II.3.1.5** <br>
> "Customers interact with **LaPrizza** primarily by placing orders."

- **Justification:** A client isn't obliged to place a single order, however, he can also place multiple if intended.

#### 2.2. `Customer` ◆-(has, 0..*)-> `Address`

> **1. PART II, II.3.1.1.** <br>
> "Customer information may include [...], as well as one or more addresses associated with a customer."

- **Justification:** `Address` doesn't have an identity outside the client, making the relationship a
**composition**: the address only exists while it is related with a `Customer`.
- **Multiplicity:** `1..*` is used has customers may always have at least one address related to them.

#### 2.3. `Customer` ◆-(records, 0..*)-> `DietaryRestriction`

> **1. PART II, II.3.1.1.** <br>
> "Customers may provide information concerning known food intolerances or other relevant dietary restrictions."

- **Justification:** Just as `Address`, `DietaryRestriction` has no meaning outside the specific customer context.
- **Multiplicity:** `0..*` as not all customers may have dietary restrictions, but one can have multiple.

---

### 3. Product

#### 3.1. `Product` -(classified, 1)-> `ProductCategory`

> **1. PART II, II.3.1.2.** <br>
> "Products may be organized into categories..."
> 
> **2. PART III, BCK05** <br>
> "a product must be associable with an appropriate Product Category."

- **Justification:** As stated in **BCK05**, a `Product` must be related to exactly one category.
- **Multiplicity:** `1` as a `Product` must be related to one and only category.

#### 3.2. `Product` -(may contain, 1..*)-> `Allergen`

> **1. PART II, II.3.1.2.** <br>
> "Products must contain or be associated with one or more allergens."
> 
> **2. PART III, BCK05** <br>
> "products must be associated with one or more allergens."

- **Justification:** A `Product` must relate to at least one `Allergen`.

#### 3.3. `Product` -(may maintain, 0..1)-> `StockInformation`

> **1. PART II, II.3.1.4.** <br>
> "Some products may additionally be subject to stock control."
> 
> **2. PART III, BCK09** <br>
> "Stock information must only be maintained for products designated as subject to stock control."

- **Justification:** Only products subject to stock control will have `StockInformation`.
- **Multiplicity:** `0..1` as a `Product` either is, or isn't, subject to stock control.

#### 3.4. `Product` -(component role, 0..1)-> `PizzaComponentType`

> **1. PART II, II.3.1.3.** <br>
> "When a product is designated for use as a pizza component, it is associated with exactly one Pizza Component 
> Type [...]. This designation does not create a separate product or component entity; rather, it adds 
> pizza-specific classification and configuration information to the existing product."
> 
> **2. PART III, BCK05** <br>
> "a product designated as a Pizza Component must be associated with exactly one Pizza Component Type."

- **Justification:** A `Product` may be a pizza component, but it isn't mandatory.
- **Multiplicity:** `0..1` enforces the fact that it either is, or is not, a pizza component.

---

### 4. Pizza

#### 4.1. `ComponentSizeConfiguration` -(for, 1)-> `PizzaSize`

> **1. PART II, II.3.1.3.** <br>
> "The size-dependent characteristics of a pizza component can be represented through a Component Size 
> Configuration. Such a configuration associates a product designated as a pizza component with a particular
> Pizza Size and establishes the information applicable when that component is used in a pizza of that size."
> 
> **2. PART III, BCK08** <br>
> "a Component Size Configuration must associate a Pizza Component with a Pizza Size." <br>
> "for a given Pizza Component and Pizza Size, at most one applicable Component Size Configuration may exist."

- **Justification:** The document text shows that a pizza component configuration is dependent of the pizza size.
- **Multiplicity:** `1` because a `ComponentSizeConfiguration` is exclusive to each `PizzaSize` there is.

#### 4.2. `PizzaConfiguration` -(composed of, 0..*)-> `Product`

> **1. PART II, II.3.1.3.** <br>
> "A personalized pizza may therefore be created by selecting a pizza size and modifying the components of a 
> predefined pizza, or replacing available components."
> 
> **2. PART III, BCK10** <br>
> "a Predefined Pizza must define a default pizza configuration composed of products designated as
> Pizza Components."

- **Justification:** Once a `Product` may be a pizza component, the configuration of a predefined pizza must
include those products.
- **Multiplicity:** `0..*` as the configuration of a pizza depends on the defined maximum quantity of a component,
defined for that specific pizza configuration.

#### 4.3. `PredefinedPizza` -(represented by, 1)-> `Product`

> **1. PART II, II.3.1.3.** <br>
> "A predefined pizza is represented as a sellable product..."
> 
> **PART III, BCK10** <br>
> "a Predefined Pizza must be represented by an appropriate sellable product."

- **Justification:** As stated on the oficial documents, a `PredefinedPizza` must be a sellable product.

#### 4.4. `PredefinedPizza` ◆-(defaultConfiguration, 1)-> `PizzaConfiguration`

> **1. PART II, II.3.1.3.** <br>
> "A predefined pizza [...] defines and initial selection of pizza components."

- **Justification:** To define the components present on the available default pizza we need to set its 
configuration.

#### 4.5. `PizzaConfiguration` -(originatedFrom, 0..1)-> `PredefinedPizza`

> **1. PART II, II.3.1.3.** <br>
> "Such a configuration [personalized pizza] may retain a reference to the predefined pizza from which it 
> originated..."

- **Justification:** A personalized pizza may be created from a change in the configuration of a predefined one.
- **Multiplicity:** `0..1` as a personalized pizza can either be created from scratch, 
or derive from a predefined pizza.

---

### 5. Orders

#### 5.1. `Order` ◆-(contains, 1..*)-> `OrderItem`

> **1. PART II, II.3.1.5.** <br>
> "An order consists of one or more Order Items..."

- **Justification:** For an order to be made, at least one item must be required by the customer.

#### 5.2. `OrderItem` -(catalogue product, 0..1)-> `Product`

> **1. PART II, II.3.1.5.** <br>
> "An order item may correspond directly to a sellable product from the LaPrizza catalogue."

- **Justification:** As for predefined pizzas the order item will be a direct product from the catalogue, however,
for personalized ones it may preserve the pizza configuration instead.

#### 5.3. `OrderItem` ◆-(preserved configuration, 0..1)-> `PizzaConfiguration`

> **1. PART II, II.3.1.5.** <br>
> "[...] the order item may instead preserve the particular pizza configuration selected by the customer." <br>
> "This preserved configuration provides the basis for determining its price, allergens, stock consumption, and 
> preparation requirements independently of subsequent changes to the corresponding catalogue information."

- **Justification:** When an order item is not a direct sellable product, it may be a personalized pizza. However,
in this case, the item may be an exact copy of the changed pizza configuration.

#### 5.4. `OrderItem` -(may require, 1..*)-> `PreparationActivity`

> **1. PART II, II.3.1.6.**
> "Depending on the item ordered, fulfilling an order may involve one or more Preparation Activities."

- **Justification:** When the order item is a beverage, for example, it does not need any `PreparationActivity`. 
However, when it is a pizza, at least activities associated with assembly and baking may occur.

---

### 6. Kitchen

#### 6.1. `PreparationActivity` -(uses, 0..*)-> `KitchenResource`

> **1. PART II, II.3.1.6.** <br>
> "They [preparation activities] may also require access to limited Kitchen Resources, 
> such as preparation stations and ovens."

- **Justification:** Not all preparation activities may require the use of resources, even though, when talking
about a pizza, most do.

#### 6.2. `PreparationActivity` -(dependsOn, 0..*)-> `PreparationActivity`

> **1. PART II, II.3.1.6.** <br>
> "Preparation activities may depend on the completion of other activities, thereby establishing sequencing
> constraints within the preparation process."

- **Justification:** As some of the activities may depend on the completion of others this relationship 
is fundamental to represent the business procedure.