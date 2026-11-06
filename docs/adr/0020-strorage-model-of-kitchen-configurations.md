# Strorage Model of Kitchen Configurations

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

The system needs to persist kitchen configurations containing dimensions, equipment positions, and visual properties. We must decide how to store this nested JSON data in MongoDB

## Decision Drivers

* Easy schema validation upon creation and updates.
* Flexible enough to accomodate future 3D viewer requirements.
* Efficient retrieval for the frontend 3D viewer.

## Considered Options

* Store as a raw stringified JSON field
* Store as a nested BSON object within the document

## Decision Outcome

Chosen option: "Store as a nested BSON object within the document", because it enables native MongoDB/Mongoose schema validation and ensures data integrity at the database level

### Positive Consequences

* Strong typing and validation in the backend

### Negative Consequences

* Any new properties required by the 3D viewer will necessitate a backend schema update

## Pros and Cons of the Options

### Store as a raw stringified JSON field

* Good, because it prevents MongoDB from altering the exact format
* Good, because it avoids deep schema mapping
* Bad, because it makes partial updates and backend field-level validation difficult

### Store as a nested BSON object within the document

* Good, because it leverages Mongoose's schema validation
* Good, because it allows querying specific nested fields, if needed
* Bad, because it required defining a strict schema for the potentially flexible 3D properties
