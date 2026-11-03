# Context

The system is developed in the LEI-ISEP 5th Semester Integrative Project (2026/27).
The project simulates a **Request for Proposal** issued by **LaPrizza**. Each team acts as an independent IT company and builds a prototype (proof of concept) that shows the integration of several technologies and the feasibility of the proposed architecture.

The participating course units are ASIST, ARQSI, IARTI, LAPR5 and SGRAI. The work is organized in three sprints, each delivering an integrated MVP.

| **Sprint** | **Period**               | **Participating UCs**             | **Focus**                                                                                                              |
| :--------: | :----------------------- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
|     1      | 14/09/2026 to 25/10/2026 | LAPR5, ARQSI                      | Project setup; <br> Domain modelling; <br> System architecture; <br> First iteration of the back-end and its REST APIs |
|     2      | 26/10/2026 to 22/11/2026 | LAPR5, ARQSI, ASIST, IARTI, SGRAI | Development and integration of the second MVP                                                                          |
|     3      | 23/11/2026 to 20/12/2026 | LAPR5, ARQSI, ASIST, IARTI, SGRAI | Development; <br> Integration and consolidation of the third MVP                                                       |

The final assessment takes place between **04/01/2027** and **07/01/2027**.

**Goals Of The Architecture:**

- Identify the principal applications, modules and external systems, their responsibilities and their interactions (ARC02);
- Allow the progressive integration of the **Web Application**, **3D Visualization**, **AI Scheduling** and **Infrastructure** without redesigning what already exists;
- Keep domain and business rules independent of presentation, persistence and infrastructure mechanisms;
- Define a clear architecture for the back-end delivered in Sprint 1, and keep the implementation consistent with the documented architecture;
- Record the relevant architectural decisions and their rationale, so that the stakeholders can find what they need.

## Level 1 Logical View (System Context)

Each actor has different functionalities in the system:

- `Customers` can browse the catalogue, place orders, and customize pizzas;
- `Employees` handle operational tasks like checking the catalogue, managing stock, and kitchen orders;
- `Managers` maintain the core business information (users, roles, customers, products, categories, allergens, pizza configurations, and AI planning triggers).

![Level 1: Logical View](../design/views.md#level-1-logical-view)

## Element Catalog

| Element | Type | Responsability |
|:--------|:-----|:---------------|
| `Customer` | Person | Consumer of the restaurant's products. Consults the product catalogue, customizes pizzas, and places orders. |
| `LaPrizza Employee` | Person | Restaurant staff member handling operations (stock adjustments, food preparation, catalogue consultation). |
| `LaPrizza Manager` | Person | Administrator maintaining the business information (catalog, users, rules) and executing AI planning. |
| `LaPrizza Information System` | Software System | Manages the restaurant operations, from ordering to food preparation and scheduling. |
| `External Identity Provider` | External System | Third-party system responsible for handling external user authentication. | 