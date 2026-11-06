# Import Approach

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [WEB06] Kitchen Configuration and 3D Integration Page

## Context and Problem Statement

Manages need to upload JSON files to create configurations. We must decide whether to handle files on the backend or frontend.

## Decision Drivers

* API simplicity.
* Backend security and parsing overhead.

## Considered Options

* Dedicated `multipart/form-data` upload endpoint
* File read in the browser and sent as `application/json`

## Decision Outcome

Chosen option: "File read in the browser and sent as application/json", because it keeps the REST API uniform and shifts parsing overhead to the client.

### Positive Consequences

* Simplified backend routing and validation.

### Negative Consequences

* Frontend must handle file `fileReader` APIs and parsing errors before transmission.

## Pros and Cons of the Options

### Dedicated multipart/form-data upload endpoint

* Good, because it handles large files natively
* Bad, because it requires configuring `multer` or similar middleware, increasing backend complexity and security surface area

### File read in the browser and sent as application/json

* Good, because the backend API remains strictly JSON, utilizing the standard `POST /` endpoint
* Bad, because very large JSON files could cause browser memory issues (unlikely for kitchen layouts)
