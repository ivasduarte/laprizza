# Problem Statement

**LaPrizza** is a modern pizza restaurant that prepares and sells pizzas, beverages and other food products. <br> The information system supports the operation and management of the restaurant: 
- Customers and their dietary restrictions;
- Products and allergens;
- Product categories;
- Pizza sizes and components;
- Stock control;
- Customer orders;
- Food preparation;
- Kitchen scheduling.

The system is a modular, web-based information system organized around the areas below. They cooperate through well-defined interfaces and APIs while remaining independent enough to be developed, deployed, maintained and evolved separately.

| **Area** | **Responsibility** | **State in Sprint 1** |
|:--------|:------------------|:---------------------|
| Back-end Application | Business rules, persistence, authentication and authorization, and the REST API for all business capabilities | Implemented (BCK and ARC user stories) |
| Web Application | Main user interface to business capabilities (identity, customers, products, stock, pizza configuration, orders, food preparation) | Considered in the architecture, not implemented |
| 3D Visualization and Interaction | Web-based 3D modules ("Build Your Pizza" and kitchen/food preparation visualization) that consume information from the rest of the system | Considered in the architecture, not implemented |
| AI Scheduling | Planning and scheduling of food preparation activities over the available kitchen resources | Considered in the architecture, not implemented |
| Systems Administration and Infrastructure | Deployment, security, backup, recovery, availability and scalability of the components | Planned |

The **users** are `customers` and `restaurant staff`. Each user has **one or more role**s that determine which operations are authorized.

**LaPrizza Staff** is the group of people who operate the restaurant. It has two roles in the system: `Manager` and `Employee`.

| **Actor** | **Role In The System** | **Main Goals** |
|:---------|:----------------------|:--------------|
| `LaPrizza Manager` | Manages the business information of the restaurant and the users and roles of the system | **Sprint 1:** Maintain users and roles (BCK01), Customers (BCK02), Product Categories (BCK03), Allergens (BCK04), Products (BCK05), Pizza Sizes (BCK06), Pizza Component Types (BCK07), Component Size Configurations (BCK08), Stock (BCK09) and Predefined Pizzas (BCK10). <br> **Planned:** Oversee orders and kitchen operations |
| `Employee` | Restaurant staff who support the daily operation | **Sprint 1:** Authenticate with the `Employee` role (BCK01); no dedicated user story. <br> **Planned:** Process orders and perform food-preparation activities, consulting kitchen resources and the state of ordered items |
| `Customer` | Consumer of the restaurant's products | **Sprint 1:** Consult the product catalogue, with prices, allergens, and the default configuration and sizes of predefined pizzas (BCK11). <br> **Planned:** Build personalised pizzas, place orders and follow their progress |

The **System Specification** does not identify external systems that integrate with LaPrizza. This point stays open and is revisited in the Functional and Level 2 Logical Views.

**Only the back-end is implemented in Sprint 1.** The remaining areas are part of the architecture because the domain analysis and the system architecture must cover the whole system.


## Significant Driving Requirements

Drivers come from three forces: **user**, **business** and **system**. Each one is written as `"driver -> consequence for the architecture"`.


### Requirements

| **Driver** | **Consequence For The Architecture** |
|:----------|:------------------------------------|
| Users, roles and authentication; <br> Protected operations are tied to an identified and authorized user (BCK01) | Authentication and role-based authorization are cross-cutting capabilities of the back-end. <br> Credentials are never stored in clear text. The role model is the base for later authorization rules. |
| A Product may be sellable, stock-controlled, a pizza component, or a combination of these (BCK05, System Specification II.3.1.2) | The domain models these as characteristics of a single Product, not as a type hierarchy. <br> A Pizza Component is a Product with exactly one Pizza Component Type, not a separate entity. |
| Pizza Component Types, Pizza Sizes, Product Categories and Allergens must be able to evolve without code changes (BCK03, BCK04, BCK06, BCK07) | They are stored as configurable data. The initial Pizza Component Types (base dough, cheese, topping) are loaded as reproducible seed data and are not hard-coded in domain logic. |
| At most one Component Size Configuration per Pizza Component and Pizza Size, holding price and abstract stock units consumed (BCK08) | The uniqueness rule and the validation of price and stock consumption belong to the domain and are also enforced by the persistence constraints. |
| A Predefined Pizza has a default configuration that respects the cardinality of each Pizza Component Type, contains only active Pizza Components, has no repeated component, and is only available in sizes for which all its components have a Component Size Configuration (BCK10) | These invariants span several concepts (Product, Pizza Component Type, Component Size Configuration). <br> They live in the domain layer and access the other concepts through repository interfaces. They are not placed in controllers or in persistence code. |
| Stock is a non-negative integer number of abstract stock units and a reduction must never produce a negative quantity (BCK09) | The stock invariant is in the domain. Stock changes are validated before being persisted. <br> How concurrent updates are handled is an open point, to be decided with the persistence approach. |
| Referenced entities must not be removed in a way that compromises consistency, and products no longer in use must be distinguishable without losing history (BCK02 to BCK08) | Products are deactivated instead of deleted. <br> Referential and business consistency is enforced by the domain and by the persistence constraints. |
| Customers consult the sellable catalogue, including allergens and, for Predefined Pizzas, the default configuration and available sizes (BCK11) | The application layer offers read-oriented queries that return the information maintained by the system, so that the catalogue is always consistent with the business information. |
| Customers have name, contact information and dietary restrictions that relate to the allergen catalogue (BCK02, System Specification II.3.1.1) | Dietary restrictions reference the Allergen catalogue. <br> Customer data is personal data and is handled under GDPR. |
| Confirmed orders must preserve the selected pizza configuration independently of later catalogue changes (System Specification II.3.1.5). Not implemented in Sprint 1. | The domain model must be able to hold a configuration snapshot in an order item. <br> No Sprint 1 decision may prevent this. |



### Constraints
 
| **Driver** | **Consequence For The Architecture** |
|:------|:--------------------------------|
| Back-end in JavaScript with `Node.js`, `Express` and `npm` | The back-end follows the conventions of this platform (see 2.2.4 and [ADR-0001](./decisions/0001-backend-platform.md)). |
| Sprint 1 limited to the back-end, with the domain analysis and architecture covering the whole system (ARC01, ARC02) | The architecture documents every area, and the views identify which components exist in Sprint 1. |
| Business functionality exposed through a REST API with a machine-readable contract that stays consistent with the implementation (ARC03) | The API is described with OpenAPI, versioned in the URL (`/api/v1`) and validated against the implementation. |
| The API will be consumed by the Web Application, 3D Visualization, AI and other components (ARC03) | The back-end exposes business capabilities and carries no user interface logic. The interfaces are stable and versioned. |
| Planning and scheduling in Prolog (IART, Sprint 2 onwards, System Specification II.3.4) | The AI module is a separate component integrated through APIs. <br> The back-end must be able to provide order and preparation information to it. |
| 3D modules with WebGL and Three.js (SGRAI, Sprint 2 onwards, System Specification II.3.3) | The 3D modules are web clients of the back-end API (sizes, components, types, configuration rules, prices, allergens). |
| The persistence mechanism must create and evolve the structures and initialize the application reproducibly (ARC04) | Schema migrations and seed data are part of the repository. |
| Personal data must follow GDPR (System Specification II.3.6) | Access to customer data is controlled by authentication and authorization, and only the data needed is stored. |
| Repository on GitHub, a submission tag per sprint, team of four, 14 weeks (System Specification II.2) | Documentation is a living part of the repository, kept short and versioned together with the code. |


### Quality Attributes
 
| **Driver** | **Consequence For The Architecture** |
|:------|:--------------------------------|
| **Security and Access Control:** Authentication, authorization, credential protection, GDPR | A dedicated authentication and authorization approach, recorded in an ADR. |
| Data integrity and consistency across persisted information (ARC04) | Invariants in the domain and constraints in persistence, both tested. |
| **Recoverability:** Business data could be accidentally deleted or corrupted | Products deactivated instead of deleted; <br> Reproducible schema and seed data. |
| Stability and scalability are mentioned in the System Specification without quantified targets | No numeric targets are defined yet. They are added here if they are agreed. |
| Interoperability between components | REST, OpenAPI and versioned interfaces. |
| **Maintainability and Testability:** Each sprint extends the previous one (ARC05) | Layering, small modules, configurable business data, and tests at layer boundaries that any team member can repeat. |