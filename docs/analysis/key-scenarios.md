# Key Scenarios
 
| **Scenario** | **Why It Is Key** |
|:--------|:-------------|
| A registered `user` authenticates and then calls a protected operation (BCK01) | Architecturally significant and a quality x functionality case (security). <br> It crosses every layer and is the base for all authorization. |
| A `manager` creates a Predefined Pizza whose default configuration is validated against component type cardinality, active components and available sizes (BCK10) | **Risk:** invariants across several concepts. It decides where cross-concept rules live. |
| A `manager` changes or adds a Pizza Component Type without changing the source code (BCK07) | Trade-off between flexibility (configurable data) and simplicity (fixed types). |
| A stock reduction is requested for a product with few units left (BCK09) | Quality x functionality (data integrity). <br> It tests the invariant and the behavior under concurrent updates. |
| A `Product Category`, `Allergen`, `Pizza Size` or `Product` that is referenced elsewhere is removed or deactivated (BCK03 to BCK08) | Referential consistency across the whole model. |
| A `customer` consults the catalogue and the details of a Predefined Pizza (BCK11) | Consistency between what is shown and the business information. <br> It also shapes the read side of the API. |
| The `kitchen` schedule produced by the AI module is consumed by the Web Application and the 3D visualization *(not in Sprint 1)* | **Risk:** integration of different technologies and data ownership. <br> It drives the need for stable, versioned interfaces. |