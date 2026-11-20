# Glossary

| **_TEA_** (EN) | **_TEA_** (PT) | **_Description_** (EN) |
|:---|:---|:---|
| **Abstract Stock Unit** | **Unidade Abstrata de Stock** | The unit in which stock quantities, component consumption and supplier offers are expressed, so that they can be compared without physical units. |
| **Account Status** | **Estado da Conta** | The current state of a user account (for example inactive until activated, active, or disabled), which determines whether the user can sign in. |
| **Active Kitchen Configuration** | **Configuração de Cozinha Ativa** | The single kitchen configuration currently selected to be shown in the 3D viewer; activating one deactivates the previous one. |
| **Address** | **Morada** | A customer's address, storing details such as street, house number, complement, postal code, city, and district. |
| **Aggregate Classification** | **Classificação do Agregado** | Indicates whether a product aggregate is produced internally from its items (Produced) or bought ready-made (Purchased). |
| **Aggregate Item** | **Item do Agregado** | A product, with its quantity, that is part of the composition of a product aggregate. |
| **Allergen** | **Alergénio** | An allergen recognized by the restaurant, used to inform customers and staff about potential dietary risks. |
| **Assembly Line Configuration** | **Configuração da Linha de Montagem** | A reusable definition of the automated pizza assembly line (dimensions and elements), placed in the kitchen by a kitchen configuration. |
| **Assembly Order** | **Ordem de Montagem** | The required sequence in which a specific pizza component type is added during the preparation of a pizza. |
| **Authentication Session** | **Sessão de Autenticação** | A user's signed-in session, kept through a refresh token until it expires or is revoked. |
| **Bill of Materials (BOM)** | **Lista de Materiais** | The components, and the quantities in abstract stock units, needed to make each predefined pizza in each size. |
| **Catalogue** | **Catálogo** | The set of sellable products offered by LaPrizza. |
| **Component Size Configuration** | **Configuração de Tamanho do Componente** | Specific pricing and stock consumption information for a pizza component when used in a particular pizza size. |
| **Consumption Forecast** | **Previsão de Consumo** | An estimate of the daily quantities of sellable products, including pizzas and their sizes, expected to be consumed over a period. |
| **Customer** | **Cliente** | A registered customer who interacts with the system. |
| **Dietary Restriction** | **Restrição Alimentar** | A known dietary restriction or food intolerance registered for a customer. |
| **External Identity** | **Identidade Externa** | The identity of a user at an external identity provider, identified by the provider's issuer and the user's subject identifier. |
| **Forecast Entry** | **Entrada da Previsão** | The quantity of one product (and size, for pizzas) expected on one day of a forecast; omitted entries mean zero consumption. |
| **Forecast Version** | **Versão da Previsão** | An immutable revision of a forecast; editing a forecast creates a new version, so earlier planning results keep their meaning. |
| **Identity Provider** | **Fornecedor de Identidade** | A third-party system (here Google or Microsoft) that authenticates the user through OpenID Connect and vouches for the identity. |
| **Kitchen Configuration** | **Configuração da Cozinha** | A named description of the kitchen layout (dimensions and the placement, orientation, and scale of its elements) used by the 3D viewer. |
| **Kitchen Resource** | **Recurso de Cozinha** | A physical asset or limited resource in the kitchen, such as a preparation station or an oven, with a specific capacity. |
| **Lead Time** | **Prazo de Entrega** | The number of days between placing an order with a supplier and the delivery of the goods. |
| **Manager / Employee** | **Gestor / Funcionário** | Roles of users who operate the system (the client mentioned Customer, Manager and Employee as example roles). |
| **Marketing Consent** | **Consentimento de Marketing** | The explicit permission given by a customer to receive marketing and promotional communications. |
| **Order** | **Encomenda** | A requested purchase placed by a customer, detailing the items desired and tracking its operational state over time. |
| **Order Item** | **Item da Encomenda** | A specific line item within an order, representing either a standard catalogue product or a custom pizza configuration with its respective quantity and unit price. |
| **Order State** | **Estado da Encomenda** | The current operational phase of an order. |
| **Password Reset Token** | **Token de Redefinição de Palavra-passe** | A single-use, time-limited token that allows a user to define a new password. |
| **Personalized Pizza** | **Pizza Personalizada** | An order-specific pizza configuration, typically derived from a predefined pizza by adding, removing or replacing components; not a catalogue product. |
| **Pizza Component** | **Componente de Pizza** | A product designated as suitable for configuring and assembling pizzas. |
| **Pizza Component Type** | **Tipo de Componente de Pizza** | A business classification of a component's role in a pizza, defining its assembly order and quantity limits. |
| **Pizza Configuration** | **Configuração da Pizza** | The specific composition of a pizza. |
| **Pizza Size** | **Tamanho da Pizza** | The commercial size category of a pizza. |
| **Planning Run** | **Execução de Planeamento** | The saved result of a planning calculation, together with the forecast version, supplier scenario version, stock and BOM it used. |
| **Predefined Pizza** | **Pizza Predefinida** | A standard menu pizza with a default base configuration, serving as an option or a starting point for customer customization. |
| **Preparation Activity** | **Atividade de Preparação** | A specific kitchen task or unit of work required to prepare and fulfill an order item, tracking its expected duration and state. |
| **Preparation State** | **Estado de Preparação** | The current status of a specific kitchen task or activity. |
| **Product** | **Produto** | An item managed by the restaurant catalog. It can act as a direct sellable item, a pizza component, or both, and may be subject to stock control. |
| **Product Aggregate** | **Produto Agregado** | A product composed of other products (for example a dough or a sauce), classified as produced internally or purchased. |
| **Product Category** | **Categoria de Produto** | A classification category used to group and organize products within the restaurant's catalog. |
| **Refresh Token** | **Token de Renovação** | A long-lived credential of an authentication session, used to obtain new access tokens without signing in again. |
| **Role** | **Papel / Função** | A set of permissions assigned to a user, distinguishing their responsibilities and allowed operations within the system. |
| **Sellable Product** | **Produto Vendável** | A product that may be offered for sale to customers; it does not imply that it is currently available. |
| **Simulation** | **Simulação** | A calculation that uses simulated inputs and only produces results; it never changes stored stock nor creates purchase orders. |
| **Stock Controlled** | **Sujeito a Controlo de Stock** | A property indicating whether a specific product's inventory levels are actively tracked by the system. |
| **Stock Information** | **Informação de Stock** | A record tracking the current available physical quantity of a specific product subject to stock control. |
| **Supplier** | **Fornecedor** | A company listed in a supplier scenario that can sell products to LaPrizza. |
| **Supplier Offer** | **Oferta de Fornecedor** | The conditions under which a supplier sells a product: price in euros, abstract stock units covered by that price, lead time, and an optional supply limit. |
| **Supplier Scenario** | **Cenário de Fornecedores** | An imported, versioned set of suppliers and their offers for each product, always marked as simulated. |
| **Supply Limit** | **Limite de Fornecimento** | The maximum quantity a supplier can provide for a product; when absent, the capacity is unknown, not zero. |
| **User** | **Utilizador** | A registered individual who signs in with a local password or an external identity and, according to their roles, can access protected functionalities in the system. |

## Acronyms

| **Acronym** | **Meaning / Description** |
|:---|:---|
| **API / REST** | Application Programming Interface / Representational State Transfer |
| **BOM** | Bill of Materials |
| **DDD** | Domain-Driven Design |
| **DM** | Domain Model  |
| **DTO** | Data Transfer Object |
| **EUR** | Euro (currency of supplier prices) |
| **GDPR (RGPD)** | General Data Protection Regulation |
| **HTTP** | Hypertext Transfer Protocol |
| **JSON** | JavaScript Object Notation |
| **JWT** | JSON Web Token |
| **LLM** | Large Language Model |
| **OIDC** | OpenID Connect |
| **OpenAPI (OAS)** | Specification to describe REST APIs in a machine-readable format |
| **RBAC** | Role-Based Access Control |
| **SAD** | Software Architecture Document |
| **SPA** | Single-Page Application |
| **UUID** | Universally Unique Identifier |
| **WebGL** | Web Graphics Library |
