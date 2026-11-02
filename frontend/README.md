# Frontend

Single-Page Application (SPA) of the LaPrizza information system (WEB01).
Technology and structure are justified in [ADR-0007](../docs/design/decisions/0007-web-application.md).

## Requirements

- **Node.js:** `v22.x` (LTS)
- **Package Manager:** `npm` `v10.x` (bundled with Node.js 22)

## Installation

From the repository root, navigate to the `frontend` directory and install the dependencies:

```bash
cd frontend
npm ci
```

## Configuration

Copy `.env.example` to `.env` (never committed) and adjust it for your environment.

| Variable            | Purpose                                                         | Example                        |
| ------------------- | --------------------------------------------------------------- | ------------------------------ |
| `VITE_PORT`         | Dev server port                                                 | `4200`                         |
| `VITE_ORIGIN`       | Dev server origin (must match the back-end CORS allowed origin) | `http://localhost:4200`        |
| `VITE_API_BASE_URL` | Base URL of the back-end REST API, including the version prefix | `http://localhost:3000/api/v1` |

> **Important:** every `VITE_*` variable is embedded in the public bundle. Never put passwords, tokens or any other secret in them. Credentials and tokens must never be stored in the application files.

For another environment (staging, production) set the same variables at build time, e.g. `VITE_API_BASE_URL=https://staging.example/api/v1 npm run build`.

## Scripts

| Command           | Description                           |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the dev server                  |
| `npm run build`   | Production build into `dist/`         |
| `npm run preview` | Serve the production build locally    |
| `npm test`        | Run the unit tests (Node test runner) |
| `npm run lint`    | Run ESLint                            |
| `npm run format`  | Format with Prettier                  |

## Structure

```
src/
  app.jsx                 routes generated from the feature registry
  main.jsx                entry point (router)
  features/
    registry.js           list of features: id, path, label, lazy loader
    home/ kitchen/ ai/
  shared/
    api/                  HTTP client (single access point to the REST API)
    ui/                   common layout and backend status
```

### Adding a feature

1. Create `src/features/<name>/<name>-page.jsx` with a default-exported component.
2. Add an entry to `src/features/registry.js`.
3. Call the back end only through `src/shared/api` (`import { api } from '../../shared/api/index.js'`).

The 3D viewer (`kitchen`) and the AI pages (`ai`) are registered like any other feature, so they are rendered inside the common layout and use the same API client.
