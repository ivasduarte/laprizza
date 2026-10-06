# LaPrizza Back-End (Sprint A Skeleton)

Bare starting point for the LaPrizza back-end application: tooling, configuration and basic
HTTP plumbing only. Everything else (folder structure, architecture, domain, persistence,
authentication, business endpoints) is designed and implemented by the team.

## Technology and Architecture

This back-end uses **Node.js** and **Express** for the REST API. Data persistence is handled by **MongoDB** (via **Mongoose**) due to its flexible document schema.

The codebase follows a strict **[Domain-Driven Design (DDD)](/docs/Sprint%201/DomainModel/DM.puml)**  architecture to ensure a clear separation of concerns across the API, Application, Domain, and Infrastructure layers.

For the full architectural justification and UML diagrams, refer to the **[ARC02 Technical Documentation]()**.

## Requirements

- **Node.js >= 22.13.0** and npm.

## Install

```bash
npm install
```

## Configure

Copy the example file and adjust it if needed. Never commit `.env`.

```bash
cp .env.example .env
```

|   Variable    |         Default         |                   Description                    |
| :-----------: | :---------------------: | :----------------------------------------------: |
|  `NODE_ENV`   |      `development`      |      `development`, `production` or `test`       |
|    `PORT`     |         `3000`          |         Port the HTTP server listens on          |
| `CORS_ORIGIN` | `http://localhost:5173` |     Allowed CORS origin(s), comma-separated      |
| `MONGODB_URI` |      _(Mandatory)_      | Database connection string (e.g., MongoDB Atlas) |

If `.env` does not exist, the defaults above are used.

## Run

```bash
npm start      # run once
npm run dev    # run and restart on file changes
```

- Health check: <http://localhost:3000/api/v1/health>
- API documentation (Swagger UI): <http://localhost:3000/api/v1/docs>

All routes live under the `/api/v1` prefix. Errors are returned in a single JSON format:

```json
{ "error": { "status": 404, "code": "NOT_FOUND", "message": "Route not found: GET /api/v1/x" } }
```

## Architecture (DDD)

The codebase follows a structure of independent layers:

```
src/
├── api/            # Presentation Layer: Express Routes and Controllers
├── application/    # Application Layer: Services and Use Cases (User Stories)
├── domain/         # Domain Layer: Core business logic and entities
├── infrastructure/ # Infrastructure Layer: Repositories, Database Models (Mongoose), and Integrations
└── index.js        # Entry point, server configuration, and database connection
```

## Test, lint and format

```bash
npm test             # Node.js built-in test runner (files in test/ and *.test.js)
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```