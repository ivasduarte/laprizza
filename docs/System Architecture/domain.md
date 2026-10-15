# Domain Model

Below is the Domain Model diagram and the project's glossary.

## Diagram

![Domain Model](../Sprint%201/DomainModel/svg/DM.svg)

## Glossary

| **_TEA_** (EN) | **_TEA_** (PT) | **_Description_** (EN) |
|:---|:---|:---|
| **Address** | **Morada** | A customer's address, storing details such as street, city, and postal code. |
| **Allergen** | **Alergénio** | An allergen recognized by the restaurant, used to inform customers and staff about potential dietary risks. |
| **Assembly Order** | **Ordem de Montagem** | The required sequence in which a specific pizza component type is added during the preparation of a pizza. |
| **Catalogue** | **Catálogo** | The set of sellable products offered by LaPrizza. |
| **Component Size Configuration** | **Configuração de Tamanho do Componente** | Specific pricing and stock consumption information for a pizza component when used in a particular pizza size. |
| **Customer** | **Cliente** | A registered customer who interacts with the system. |
| **Dietary Restriction** | **Restrição Alimentar** | A known dietary restriction or food intolerance registered for a customer. |
| **Kitchen Resource** | **Recurso de Cozinha** | A physical asset or limited resource in the kitchen, such as a preparation station or an oven, with a specific capacity. |
| **Manager / Employee** | **Gestor / Funcionário** | Roles of users who operate the system (the client mentioned Customer, Manager and Employee as example roles). |
| **Marketing Consent** | **Consentimento de Marketing** | The explicit permission given by a customer to receive marketing and promotional communications. |
| **Order** | **Encomenda** | A requested purchase placed by a customer, detailing the items desired and tracking its operational state over time. |
| **Order Item** | **Item da Encomenda** | A specific line item within an order, representing either a standard catalogue product or a custom pizza configuration with its respective quantity and unit price. |
| **Order State** | **Estado da Encomenda** | The current operational phase of an order. |
| **Personalized Pizza** | **Pizza Personalizada** | An order-specific pizza configuration, typically derived from a predefined pizza by adding, removing or replacing components; not a catalogue product. |
| **Pizza Component** | **Componente de Pizza** | A product designated as suitable for configuring and assembling pizzas. |
| **Pizza Component Type** | **Tipo de Componente de Pizza** | A business classification of a component's role in a pizza, defining its assembly order and quantity limits. |
| **Pizza Configuration** | **Configuração da Pizza** | The specific composition of a pizza. |
| **Pizza Size** | **Tamanho da Pizza** | The commercial size category of a pizza. |
| **Predefined Pizza** | **Pizza Predefinida** | A standard menu pizza with a default base configuration, serving as an option or a starting point for customer customization. |
| **Preparation Activity** | **Atividade de Preparação** | A specific kitchen task or unit of work required to prepare and fulfill an order item, tracking its expected duration and state. |
| **Preparation State** | **Estado de Preparação** | The current status of a specific kitchen task or activity. |
| **Product** | **Produto** | An item managed by the restaurant catalog. It can act as a direct sellable item, a pizza component, or both, and may be subject to stock control. |
| **Product Category** | **Categoria de Produto** | A classification category used to group and organize products within the restaurant's catalog. |
| **Role** | **Papel / Função** | A set of permissions assigned to a user, distinguishing their responsibilities and allowed operations within the system. |
| **Sellable Product** | **Produto Vendável** | A product that may be offered for sale to customers; it does not imply that it is currently available. |
| **Stock Controlled** | **Sujeito a Controlo de Stock** | A property indicating whether a specific product's inventory levels are actively tracked by the system. |
| **Stock Information** | **Informação de Stock** | A record tracking the current available physical quantity of a specific product subject to stock control. |
| **User** | **Utilizador** | A registered individual with unique credentials (email and password) who can access protected functionalities in the system. |

## Acronyms

| **Acronym** | **Meaning / Description** |
|:---|:---|
| **API / REST** | Application Programming Interface / Representational State Transfer |
| **DDD** | Domain-Driven Design |
| **DM** | Domain Model  |
| **DTO** | Data Transfer Object |
| **GDPR (RGPD)** | General Data Protection Regulation |
| **HTTP** | Hypertext Transfer Protocol |
| **JSON** | JavaScript Object Notation |
| **JWT** | JSON Web Token |
| **OpenAPI (OAS)** | Specification to describe REST APIs in a machine-readable format |
| **RBAC** | Role-Based Access Control |
| **SAD** | Software Architecture Document |
| **UUID** | Universally Unique Identifier |
| **WebGL** | Web Graphics Library |