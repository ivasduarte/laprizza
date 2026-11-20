# Use Case Views

This document shows who uses the LaPrizza information system and which business capabilities are available to each actor in Sprint 1, plus the Kitchen Configuration and AI Planning user stories (WEB06, WEB07) of Sprint 2. The system is treated as a black box: only actors and use cases are represented, with no internal components.

- [Use Case Views](#use-case-views)
  - [Actors](#actors)
  - [Use Cases Diagram](#use-cases-diagram)
  - [User Stories](#user-stories)
    - [BCK01: User and Authentication Management](#bck01-user-and-authentication-management)
      - [Flow Mapping](#flow-mapping)
    - [BCK02: Customer Management](#bck02-customer-management)
      - [Flow Mapping](#flow-mapping-1)
    - [BCK03: Product Category Management](#bck03-product-category-management)
      - [Flow Mapping](#flow-mapping-2)
    - [BCK04: Allergen Management](#bck04-allergen-management)
      - [Flow Mapping](#flow-mapping-3)
    - [BCK05: Product Management](#bck05-product-management)
      - [Flow Mapping](#flow-mapping-4)
    - [BCK06: Pizza Size Management](#bck06-pizza-size-management)
      - [Flow Mapping](#flow-mapping-5)
    - [BCK07: Pizza Component Type Management](#bck07-pizza-component-type-management)
      - [Flow Mapping](#flow-mapping-6)
    - [BCK08: Pizza Component Configuration](#bck08-pizza-component-configuration)
      - [Flow Mapping](#flow-mapping-7)
    - [BCK09: Stock Information Management](#bck09-stock-information-management)
      - [Flow Mapping](#flow-mapping-8)
    - [BCK10: Predefined Pizza Management](#bck10-predefined-pizza-management)
      - [Flow Mapping](#flow-mapping-9)
    - [BCK11: Product Catalogue and Product Information](#bck11-product-catalogue-and-product-information)
      - [Flow Mapping](#flow-mapping-10)
    - [WEB06: Kitchen Configuration and 3D Integration](#web06-kitchen-configuration-and-3d-integration)
      - [Use Case Descriptions](#use-case-descriptions)
      - [Flow Mapping](#flow-mapping-11)
    - [WEB07: Artificial Intelligence Configuration and Execution](#web07-artificial-intelligence-configuration-and-execution)
      - [Use Case Descriptions](#use-case-descriptions-1)
      - [Flow Mapping](#flow-mapping-12)

## Actors

| Actor                | Description                                                                                                       |
| :------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **System User**      | Any registered entity capable of authenticating into the system. Acts as the base role.                           |
| **LaPrizza Manager** | Administrator with full back-office access to manage users, customers, products, stock, and configurations.       |
| **Employee**         | Restaurant staff member with operational access (e.g., consult catalogs, adjust stock, manage predefined pizzas). |
| **Customer**         | External client interacting with the system to consult the catalog or register their data.                        |
| **3D Visualization Module** | Secondary (system) actor. The embedded 3D viewer that consumes the active kitchen configuration to render the kitchen. |
| **AI Scheduling Module** | Secondary (system) actor. The SWI-Prolog service that calculates the requirements planning of a forecast. It is called only by the Back-End Application, never by the Manager's browser. |

## Use Cases Diagram

![Global Use Case View](./diagrams/use-case-views/global-use-case-view.svg)

## User Stories

### BCK01: User and Authentication Management

![BCK01 Use Case View](./diagrams/use-case-views/bck01-use-cases-view.svg)

#### Flow Mapping

| User Story | Use Case               | Primary Actor    | Flow Document (SAD)                                  |
| :--------- | :--------------------- | :--------------- | :--------------------------------------------------- |
| **BCK01**  | UC1: Authenticate User | System User      | [Login](../flows/authentication/login.md)            |
| **BCK01**  | UC2: Register User     | LaPrizza Manager | [Register User](../flows/authentication/register-user.md) |
| **BCK01**  | UC3: List Users        | LaPrizza Manager | [List Users](../flows/user/list-users.md)                  |
| **BCK01**  | UC4: Get User          | LaPrizza Manager | [Get User](../flows/user/get-user.md)                     |
| **BCK01**  | UC5: Update User       | LaPrizza Manager | [Update User](../flows/user/update-user.md)               |

### BCK02: Customer Management

![BCK02 Use Case View](./diagrams/use-case-views/bck02-use-cases-view.svg)

#### Flow Mapping

| User Story | Use Case               | Primary Actor    | Flow Document (SAD)                                         |
| :--------- | :--------------------- | :--------------- | :---------------------------------------------------------- |
| **BCK02**  | UC1: Register Customer | LaPrizza Manager | [Register Customer](../flows/customer/register-customer.md) |
| **BCK02**  | UC2: List Customers    | LaPrizza Manager | [List Customers](../flows/customer/list-search-customer.md) |
| **BCK02**  | UC3: Update Customer   | LaPrizza Manager | [Update Customer](../flows/customer/update-customer.md)     |

### BCK03: Product Category Management

![BCK03 Use Case View](./diagrams/use-case-views/bck03-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                     | Primary Actor    | Flow Document (SAD)                                                                  |
| :--------- | :--------------------------- | :--------------- | :----------------------------------------------------------------------------------- |
| **BCK03**  | UC1: Create Product Category | LaPrizza Manager | [Create Product Category](../flows/product-category/create-product-category.md)      |
| **BCK03**  | UC2: List Product Categories | LaPrizza Manager | [List Product Categories](../flows/product-category/list-search-product-category.md) |
| **BCK03**  | UC3: Update Product Category | LaPrizza Manager | [Update Product Category](../flows/product-category/update-product-category.md)      |
| **BCK03**  | UC4: Remove Product Category | LaPrizza Manager | [Remove Product Category](../flows/product-category/remove-product-category.md)      |

### BCK04: Allergen Management

![BCK04 Use Case View](./diagrams/use-case-views/bck04-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                      | Primary Actor               | Flow Document (SAD)                                                       |
| :--------- | :---------------------------- | :-------------------------- | :------------------------------------------------------------------------ |
| **BCK04**  | UC1: Create Allergen          | LaPrizza Manager            | [Create Allergen](../flows/allergen/create-allergen.md)                   |
| **BCK04**  | UC2: List Allergens           | LaPrizza Manager / Employee | [List Allergens](../flows/allergen/list-search-allergens.md)              |
| **BCK04**  | UC3: Consult Allergen by Id   | LaPrizza Manager / Employee | [Consult Allergen by Id](../flows/allergen/consult-allergen-by-id.md)     |
| **BCK04**  | UC4: Consult Allergen by Name | LaPrizza Manager / Employee | [Consult Allergen by Name](../flows/allergen/consult-allergen-by-name.md) |
| **BCK04**  | UC5: Deactivate Allergen      | LaPrizza Manager            | [Deactivate Allergen](../flows/allergen/deactivate-allergen.md)           |

### BCK05: Product Management

![BCK05 Use Case View](./diagrams/use-case-views/bck05-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case            | Primary Actor               | Flow Document (SAD)                                      |
| :--------- | :------------------ | :-------------------------- | :------------------------------------------------------- |
| **BCK05**  | UC1: Create Product | LaPrizza Manager            | [Create Product](../flows/product/create-product.md)     |
| **BCK05**  | UC2: List Products  | LaPrizza Manager / Employee | [List Products](../flows/product/list-search-product.md) |
| **BCK05**  | UC3: Get Product    | LaPrizza Manager / Employee | [Get Product](../flows/product/get-product.md)           |
| **BCK05**  | UC4: Update Product | LaPrizza Manager            | [Update Product](../flows/product/update-product.md)     |

### BCK06: Pizza Size Management

![BCK06 Use Case View](./diagrams/use-case-views/bck06-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case               | Primary Actor    | Flow Document (SAD)                                               |
| :--------- | :--------------------- | :--------------- | :---------------------------------------------------------------- |
| **BCK06**  | UC1: Create Pizza Size | LaPrizza Manager | [Create Pizza Size](../flows/pizza-size/create-pizza-size.md)     |
| **BCK06**  | UC2: List Pizza Sizes  | LaPrizza Manager | [List Pizza Sizes](../flows/pizza-size/list-search-pizza-size.md) |
| **BCK06**  | UC3: Get Pizza Size    | LaPrizza Manager | [Get Pizza Sizes](../flows/pizza-size/get-pizza-size.md)          |
| **BCK06**  | UC4: Update Pizza Size | LaPrizza Manager | [Update Pizza Size](../flows/pizza-size/update-pizza-size.md)     |

### BCK07: Pizza Component Type Management

![BCK07 Use Case View](./diagrams/use-case-views/bck07-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                         | Primary Actor    | Flow Document (SAD)                                                                             |
| :--------- | :------------------------------- | :--------------- | :---------------------------------------------------------------------------------------------- |
| **BCK07**  | UC1: Create Pizza Component Type | LaPrizza Manager | [Create Pizza Component Type](../flows/pizza-component-type/create-pizza-component-type.md)     |
| **BCK07**  | UC2: List Pizza Component Types  | LaPrizza Manager | [List Pizza Component Types](../flows/pizza-component-type/list-search-pizza-component-type.md) |
| **BCK07**  | UC3: Update Pizza Component Type | LaPrizza Manager | [Update Pizza Component Type](../flows/pizza-component-type/update-pizza-component-type.md)     |
| **BCK07**  | UC4: Remove Pizza Component Type | LaPrizza Manager | [Remove Pizza Component Type](../flows/pizza-component-type/remove-pizza-component-type.md)     |

### BCK08: Pizza Component Configuration

![BCK08 Use Case View](./diagrams/use-case-views/bck08-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                                  | Primary Actor    | Flow Document (SAD)                                                                                                       |
| :--------- | :---------------------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **BCK08**  | UC1: Create Pizza Component Configuration | LaPrizza Manager | [Create Pizza Component Configuration](../flows/pizza-component-configuration/create-component-size-configuration.md)     |
| **BCK08**  | UC2: List Pizza Component Configurations  | LaPrizza Manager | [List Pizza Component Configurations](../flows/pizza-component-configuration/list-search-component-size-configuration.md) |
| **BCK08**  | UC3: Update Pizza Component Configuration | LaPrizza Manager | [Update Pizza Component Configuration](../flows/pizza-component-configuration/update-component-size-configuration.md)     |
| **BCK08**  | UC4: Remove Pizza Component Configuration | LaPrizza Manager | [Remove Pizza Component Configuration](../flows/pizza-component-configuration/remove-component-size-configuration.md)     |

### BCK09: Stock Information Management

![BCK09 Use Case View](./diagrams/use-case-views/bck09-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                  | Primary Actor    | Flow Document (SAD)                                       |
| :--------- | :------------------------ | :--------------- | :-------------------------------------------------------- |
| **BCK09**  | UC1: List Product Stock   | LaPrizza Manager | [List Product Stock](../flows/stock/list-search-stock.md) |
| **BCK09**  | UC2: Get Product Stock    | LaPrizza Manager | [Get Product Stock](../flows/stock/get-stock.md)          |
| **BCK09**  | UC3: Adjust Product Stock | LaPrizza Manager | [Adjust Product Stock](../flows/stock/adjust-stock.md)    |

### BCK10: Predefined Pizza Management

![BCK10 Use Case View](./diagrams/use-case-views/bck10-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                              | Primary Actor    | Flow Document (SAD)                                                                               |
| :--------- | :------------------------------------ | :--------------- | :------------------------------------------------------------------------------------------------ |
| **BCK10**  | UC1: Define Predefined Pizza          | LaPrizza Manager | [Define Predefined Pizza](../flows/predefined-pizza/define-predefined-pizza.md)                   |
| **BCK10**  | UC2: List Predefined Pizzas           | LaPrizza Manager | [List Predefined Pizzas](../flows/predefined-pizza/list-search-predefined-pizzas.md)              |
| **BCK10**  | UC3: Consult Predefined Pizza by Id   | LaPrizza Manager | [Consult Predefined Pizza by Id](../flows/predefined-pizza/consult-predefined-pizza-by-id.md)     |
| **BCK10**  | UC4: Consult Predefined Pizza by Name | LaPrizza Manager | [Consult Predefined Pizza by Name](../flows/predefined-pizza/consult-predefined-pizza-by-name.md) |
| **BCK10**  | UC5: Update Predefined Pizza          | LaPrizza Manager | [Update Predefined Pizza](../flows/predefined-pizza/update-predefined-pizza.md)                   |
| **BCK10**  | UC6: Deactivate Predefined Pizza      | LaPrizza Manager | [Deactivate Predefined Pizza](../flows/predefined-pizza/deactivate-predefined-pizza.md)           |

### BCK11: Product Catalogue and Product Information

![BCK11 Use Case View](./diagrams/use-case-views/bck11-use-case-view.svg)

#### Flow Mapping

| User Story | Use Case                    | Primary Actor    | Flow Document (SAD)                                                           |
| :--------- | :-------------------------- | :--------------- | :---------------------------------------------------------------------------- |
| **BCK11**  | UC1: List Product Catalogue | LaPrizza Manager | [List Product Catalogue](../flows/product-catalogue/list-search-catalogue.md) |
| **BCK11**  | UC2: Get Catalogue Item     | LaPrizza Manager | [Get Catalogue Item](../flows/product-catalogue/get-catalogue-item.md)        |

### WEB06: Kitchen Configuration and 3D Integration

The Kitchen Configuration and 3D Integration page lets a Manager import kitchen configurations (dimensions, equipment positions and visual properties), choose the one that is active and keep them up to date. The 3D Visualization Module renders the active configuration, which Managers and Employees can also see on the page. Employees have a read-only view: they can list and consult the configurations and see the viewer, but the page offers no create, edit, activate or delete controls and the API refuses those operations. The accepted JSON format is in [Kitchen Configuration JSON Format](../flows/kitchen-configuration/kitchen-configuration-json-format.md).

```mermaid
flowchart LR
    Manager([LaPrizza Manager])
    Employee([LaPrizza Employee])
    Viz3D([3D Visualization Module])

    subgraph WEB06 [WEB06: Kitchen Configuration and 3D Integration]
        direction TB
        UC1([UC1: Create/Import Configuration])
        UC2([UC2: Activate Configuration])
        UC3([UC3: Get Active Configuration])
        UC4([UC4: List and Consult Configurations])
        UC5([UC5: Edit Configuration])
        UC6([UC6: Delete Configuration])
    end

    Manager --> UC1
    Manager --> UC2
    Manager --> UC3
    Manager --> UC4
    Manager --> UC5
    Manager --> UC6

    Employee --> UC3
    Employee -.->|<< read-only >>| UC4

    Viz3D -->|<< consumes >>| UC3
```

#### Use Case Descriptions

| Use Case | Primary Actor | Description | Main Rules | ADRs |
| :------- | :------------ | :---------- | :--------- | :--- |
| **UC1: Create/Import Configuration** | LaPrizza Manager | Creates a kitchen configuration from a JSON document. On the page, an imported file is read in the browser and loaded into the editor for review; saving sends it as `application/json` to the same endpoint used to create a configuration through the API. A dry-run endpoint validates a document without storing it. | The domain validates the structure with a JSON Schema (valid dimensions, scale limits) and enforces the business invariants (unique equipment ids, asset references that are absolute http(s) URLs or root-relative paths). All violations are returned together, each with its property path. The configuration is stored as a nested BSON object, keeps its assets as self-contained URL/URIs and is created inactive. | [ADR-0020](../adr/0020-strorage-model-of-kitchen-configurations.md), [ADR-0021](../adr/0021-asset-references-strategy.md), [ADR-0022](../adr/0022-content-validation-strategy.md), [ADR-0026](../adr/0026-import-approach.md) |
| **UC2: Activate Configuration** | LaPrizza Manager | Makes a stored configuration the one in use. The previously active configuration is deactivated. | Exactly one configuration is active at a time. The switch is atomic (partial unique index on the active flag and a transaction); concurrent activations answer 409 and activating the already active configuration is a no-op. After the switch, the page reloads the 3D viewer without a full page refresh. | [ADR-0023](../adr/0023-atomic-activation-strategy.md), [ADR-0027](../adr/0027-viewer-reload-mechanism-in-the-frontend.md) |
| **UC3: Get Active Configuration** | LaPrizza Manager / Employee / 3D Visualization Module | Returns the active configuration so that the 3D viewer can render the kitchen. | A dedicated endpoint serves it to the staff roles, and the viewer requests it every time it is mounted. When no configuration is active the answer is 404, the viewer shows an empty state and no hardcoded fallback layout is returned. The payload is self-sufficient, so assets are loaded directly from their URL/URIs. | [ADR-0021](../adr/0021-asset-references-strategy.md), [ADR-0025](../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md) |
| **UC4: List and Consult Configurations** | LaPrizza Manager / Employee | Lists the stored configurations, showing which one is active, and consults one of them (name and JSON content). | Read-only for the Employee: the page hides the Create, Edit, Activate and Delete controls. | [ADR-0025](../adr/0025-active-configuration-endpoint-and-no-fallback-policy.md) |
| **UC5: Edit Configuration** | LaPrizza Manager | Changes the content of a stored configuration, including the active one. | An edit is validated again with the same rules as the creation. Editing the active configuration is allowed if the new content passes all validations, and the page then remounts the viewer so that it fetches the updated layout. | [ADR-0022](../adr/0022-content-validation-strategy.md), [ADR-0024](../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md), [ADR-0027](../adr/0027-viewer-reload-mechanism-in-the-frontend.md) |
| **UC6: Delete Configuration** | LaPrizza Manager | Removes a stored configuration. | The active configuration cannot be deleted (409), and the page does not offer the Delete button for it, so that the viewer never ends up without a configuration. | [ADR-0024](../adr/0024-rules-for-editing-and-deleting-the-active-configuration.md) |

#### Flow Mapping

| User Story | Use Case                                 | Primary Actor                                         | Flow Document (SAD)                                                                                       |
| :--------- | :--------------------------------------- | :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **WEB06**  | UC1: Create/Import Configuration         | LaPrizza Manager                                      | [Create / Import Kitchen Configuration](../flows/kitchen-configuration/create-import-kitchen-configuration.md) |
| **WEB06**  | UC2: Activate Configuration              | LaPrizza Manager                                      | [Activate Kitchen Configuration](../flows/kitchen-configuration/activate-kitchen-configuration.md)         |
| **WEB06**  | UC3: Get Active Configuration            | LaPrizza Manager / Employee / 3D Visualization Module | [Get Active Kitchen Configuration](../flows/kitchen-configuration/get-active-kitchen-configuration.md)     |
| **WEB06**  | UC4: List and Consult Configurations     | LaPrizza Manager / Employee                           | [List and Consult Configurations](../flows/kitchen-configuration/list-and-consult-configurations.md) |                                                                             |
| **WEB06**  | UC5: Edit Configuration                  | LaPrizza Manager                                      | [Edit Configuration](../flows/kitchen-configuration/edit-configuration.md)                                                                             |
| **WEB06**  | UC6: Delete Configuration                | LaPrizza Manager                                      | [Delete Configuration](../flows/kitchen-configuration/delete-configuration.md)                                                                             |

The C4 context, container and component views of the feature are in [Kitchen Configuration C4 Views](../flows/kitchen-configuration/c4-views.md).

### WEB07: Artificial Intelligence Configuration and Execution

The AI configuration and execution page lets a Manager prepare the inputs of the requirements planning and run it through the AI Scheduling Module. The Manager creates, consults, edits and deactivates daily product-consumption forecasts, exports the products as JSON, imports a supplier scenario prepared by hand or with an LLM after inspecting it, executes a saved forecast version with a chosen supplier scenario, and consults every saved result together with the versions of the inputs it used. Forecasts and supplier scenarios are immutable and versioned: an edit saves the next version and a delete is a deactivation, so earlier results keep their meaning. Every calculation is a simulation: it never changes the stored stock nor creates purchase orders. The page and all its endpoints are restricted to the Manager: the back end checks a permission on every request (403 otherwise), the route `/ai` requires `planning:execute` and the navigation hides the page from other users. The accepted supplier JSON format is in [Supplier Scenario JSON Format](../flows/ai-planning/supplier-json-format.md).

```mermaid
flowchart LR
    Manager([LaPrizza Manager])
    AI([AI Scheduling Module])

    subgraph WEB07 [WEB07: Artificial Intelligence Configuration and Execution]
        direction TB
        UC1([UC1: Create Forecast])
        UC2([UC2: List and Consult Forecasts])
        UC3([UC3: Edit Forecast - new version])
        UC4([UC4: Delete - Deactivate Forecast])
        UC5([UC5: Export Products])
        UC6([UC6: Import Supplier Scenario])
        UC7([UC7: List and Consult Supplier Scenarios])
        UC8([UC8: Deactivate Supplier Scenario])
        UC9([UC9: Execute Forecast])
        UC10([UC10: Consult Planning Results])
    end

    Manager --> UC1
    Manager --> UC2
    Manager --> UC3
    Manager --> UC4
    Manager --> UC5
    Manager --> UC6
    Manager --> UC7
    Manager --> UC8
    Manager --> UC9
    Manager --> UC10

    UC3 -.->|<< extend >>| UC1
    UC9 -->|<< executes >>| AI
```

#### Use Case Descriptions

| Use Case | Primary Actor | Description | Main Rules | ADRs |
| :------- | :------------ | :---------- | :--------- | :--- |
| **UC1: Create Forecast** | LaPrizza Manager | Creates a forecast: name, period (start and end dates) and daily entries (date, sellable product, size when the product is a pizza, quantity). The page checks the form with the same rules as the back end before sending it. | Quantities are non-negative integers and omitted entries mean zero consumption. Every rule is checked and all problems are returned together: real dates, end not before start, at least one entry, dates inside the period, known and sellable product, size required for a predefined pizza and only one of its sizes, no size for other products, no duplicate date/product/size. The back end assigns the version (1, or the next one of the same name, ignoring case); a `version` sent by the client is ignored. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md), [ADR-0005](../adr/0005-contract-first-rest-api.md) |
| **UC2: List and Consult Forecasts** | LaPrizza Manager | Lists the active forecasts, grouped by name with every active version (newest first, tagged "Latest"), and shows one version with its entries, totals and the "omitted entries mean zero" note. | Only active versions are listed or returned; a deactivated or unknown id answers 404. The page builds the detail from the list; `GET /forecasts/{id}` is available through the API. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md) |
| **UC3: Edit Forecast (new version)** | LaPrizza Manager | Opens the editor prefilled with an existing version and saves the changes as the next version of the same name. | The name is read-only in the editor. Saving is a `POST` with the same name and the same rules as UC1; the edited version is never changed, so the results calculated with it stay linked to it. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md), [ADR-0034](../adr/0034-recording-planning-runs-with-their-input-versions.md) |
| **UC4: Delete (Deactivate) Forecast** | LaPrizza Manager | Removes a forecast version from the list after a confirmation dialog. | Soft delete: only `{ "isActive": false }` is accepted. The document stays in the database, the saved results keep its reference, its version number is never reused, and it can no longer be chosen for a new execution. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md) |
| **UC5: Export Products** | LaPrizza Manager | Downloads the products that can be bought as a JSON file, the input to prepare the supplier file manually or with an LLM. | Includes raw materials, purchased aggregates and stock-controlled products sold directly; excludes produced aggregates and products without stock control (pizzas). Each product has its id, name, kind and the abstract stock unit; the selling price is optional and never excludes a product. Always a fresh export. | [ADR-0035](../adr/0035-supplier-import-with-client-side-checks-and-server-dry-run.md) |
| **UC6: Import Supplier Scenario** | LaPrizza Manager | Pastes or loads a supplier JSON file, inspects it (parse, local checks and a server dry-run that stores nothing), reviews the preview and confirms to save it. | Suppliers with unique ids (name optional); products that exist, each listed once, with offers from listed suppliers, at most one per supplier; offer price in EUR ≥ 0, positive integer stock units, lead time in days ≥ 0, optional supply limit. Missing fields and invalid values are rejected with their path. A rejected file saves nothing, so the previous scenario stays in use. Saved offers are always marked simulated. Versioned like the forecasts. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md), [ADR-0035](../adr/0035-supplier-import-with-client-side-checks-and-server-dry-run.md) |
| **UC7: List and Consult Supplier Scenarios** | LaPrizza Manager | Lists the active supplier scenarios and shows the offers of one. | Products without offers, or exported products missing from the scenario, are shown as "No configured supplier"; every offer is tagged "Simulated". | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md) |
| **UC8: Deactivate Supplier Scenario** | LaPrizza Manager | Removes a supplier scenario version from the list after a confirmation dialog. | Same soft delete as UC4. Saved results keep their reference; the scenario is no longer the default for new executions. | [ADR-0033](../adr/0033-immutable-versioned-forecasts-and-supplier-scenarios.md) |
| **UC9: Execute Forecast** | LaPrizza Manager | Runs the requirements planning of a chosen forecast version with a chosen supplier scenario (by default the latest active ones) and shows daily needs, production, replenishment by product, the daily purchase plan with suppliers and expected delivery dates, unmet needs and warnings. | The back end builds the input snapshot (catalogue and BOM, stock, AI scenario, forecast, supplier scenario) and calls the AI Scheduling Module with a service key. The calculation is synchronous and read-only: stock and the scenario stock are never changed. The page shows progress, sends one request per click and maps each failure to invalid input, missing information or service unavailable. Only a successful calculation is saved as a run. | [ADR-0034](../adr/0034-recording-planning-runs-with-their-input-versions.md), [ADR-0036](../adr/0036-synchronous-ai-execution-with-duplicate-submission-guard.md) |
| **UC10: Consult Planning Results** | LaPrizza Manager | Lists the saved results, optionally for one forecast version, and opens the full plan of one of them. | Each run records the request, the forecast and supplier scenario versions, the snapshot id, the BOM version, the stock source and the full result, taken from the snapshot built by the back end. The list (100 most recent) has no full result; the detail has it. | [ADR-0034](../adr/0034-recording-planning-runs-with-their-input-versions.md) |

#### Flow Mapping

| User Story | Use Case | Primary Actor | Flow Document (SAD) |
| :--------- | :------- | :------------ | :------------------ |
| **WEB07**  | UC1: Create Forecast | LaPrizza Manager | [Create Forecast](../flows/ai-planning/create-forecast.md) |
| **WEB07**  | UC2: List and Consult Forecasts | LaPrizza Manager | [List and Consult Forecasts](../flows/ai-planning/list-and-consult-forecasts.md) |
| **WEB07**  | UC3: Edit Forecast (new version) | LaPrizza Manager | [Edit Forecast](../flows/ai-planning/edit-forecast.md) |
| **WEB07**  | UC4: Delete (Deactivate) Forecast | LaPrizza Manager | [Deactivate Forecast](../flows/ai-planning/deactivate-forecast.md) |
| **WEB07**  | UC5: Export Products | LaPrizza Manager | [Export Products](../flows/ai-planning/export-products.md) |
| **WEB07**  | UC6: Import Supplier Scenario | LaPrizza Manager | [Import Supplier Scenario](../flows/ai-planning/import-supplier-scenario.md) |
| **WEB07**  | UC7: List and Consult Supplier Scenarios | LaPrizza Manager | [List and Consult Supplier Scenarios](../flows/ai-planning/list-and-consult-supplier-scenarios.md) |
| **WEB07**  | UC8: Deactivate Supplier Scenario | LaPrizza Manager | [Deactivate Supplier Scenario](../flows/ai-planning/deactivate-supplier-scenario.md) |
| **WEB07**  | UC9: Execute Forecast | LaPrizza Manager | [Execute Forecast](../flows/ai-planning/execute-forecast.md) |
| **WEB07**  | UC10: Consult Planning Results | LaPrizza Manager | [Consult Planning Results](../flows/ai-planning/consult-planning-results.md) |

The REST API summary, the business rules and the element catalogue of the feature are in the [AI Planning README](../flows/ai-planning/README.md); the container interactions of the execution are in the Level 2 Process View of [Views](../design/views.md).
