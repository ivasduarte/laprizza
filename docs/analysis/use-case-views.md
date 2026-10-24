# Use Case Views

This document shows who uses the LaPrizza information system and which business capabilities are available to each actor in Sprint 1. The system is treated as a black box: only actors and use cases are represented, with no internal components.

* [Actors](#actors)
* [Use Cases Diagram](#use-cases-diagram)
* [User Stories](#user-stories)
    * [BCK01: User and Authentication Management](#bck01-user-and-authentication-management)
    * [BCK02: Customer Management](#bck02-customer-management)
    * [BCK03: Product Category Management](#bck03-product-category-management)
    * [BCK04: Allergen Management](#bck04-allergen-management)
    * [BCK05: Product Management](#bck05-product-management)
    * [BCK06: Pizza Size Management](#bck06-pizza-size-management)
    * [BCK07: Pizza Component Type Management](#bck07-pizza-component-type-management)
    * [BCK08: Pizza Component Configuration](#bck08-pizza-component-configuration)
    * [BCK09: Stock Information Management](#bck09-stock-information-management)
    * [BCK10: Predefined Pizza Management](#bck10-predefined-pizza-management)
    * [BCK11: Product Catalogue and Product Information](#bck11-product-catalogue-and-product-information)


## Actors

| Actor | Description |
|:------|:------------|
| **System User** | Any registered entity capable of authenticating into the system. Acts as the base role. |
| **LaPrizza Manager** | Administrator with full back-office access to manage users, customers, products, stock, and configurations. |
| **Employee** | Restaurant staff member with operational access (e.g., consult catalogs, adjust stock, manage predefined pizzas). |
| **Customer** | External client interacting with the system to consult the catalog or register their data. |

## Use Cases Diagram

![Global Use Case View](./diagrams/use-case-views/global-use-case-view.svg)


## User Stories

### BCK01: User and Authentication Management

![BCK01 Use Case View](./diagrams/use-case-views/bck01-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case | Primary Actor | Flow Document (SAD) |
| :--- | :--- | :--- | :--- |
| **BCK01** | UC1: Authenticate User | System User | [Login](../flows/authentication/login.md) |
| **BCK01** | UC2: Register User | LaPrizza Manager | [Register User](../flows/authentication/register.md) |
| **BCK01** | UC3: List Users | LaPrizza Manager | [List Users](../flows/user/list.md) |
| **BCK01** | UC4: Get User | LaPrizza Manager | [Get User](../flows/user/get.md) |
| **BCK01** | UC5: Update User | LaPrizza Manager | [Update User](../flows/user/update.md) |


### BCK02: Customer Management

### BCK03: Product Category Management

### BCK04: Allergen Management

### BCK05: Product Management

### BCK06: Pizza Size Management

### BCK07: Pizza Component Type Management

### BCK08: Pizza Component Configuration

### BCK09: Stock Information Management

### BCK10: Predefined Pizza Management

### BCK11: Product Catalogue and Product Information