# External Identity Provider Integration (AA02)

## Login Sequence

```mermaid
sequenceDiagram
    participant S as SPA
    participant B as Backend
    participant I as IdP
    S->>B: GET /auth/external/{provider}/login
    B->>B: state, nonce, code_verifier
    B-->>S: Set-Cookie lp_oidc (signed, 10 min) + 302 to IdP
    S->>I: authenticate (password only at rhe IdP)
    I-->>S: 302 /callback?code&state
    S->>B: GET /callback (cookie lp_oidc)
    B->>B: state matches cookie?
    B->>I: token endpoint (code + code_verifier + client_secret)
    I-->>B: id_token
    B->>B: validate signature, iss, aud, exp, nonce
    B->>B: resolve user (see below)
    B-->>S: Set-Cookie lp_rt + 302 SPA /auth/callback?status=success
    S->>B: POST /auth/refresh (cookie)
    B-->>S: accessToken (kept in memory)
```

## User Resolution (Domain: `resolveExternalLogin`)

```mermaid
flowchart TD
    A[id_token validated] --> B{identity issuer+sub linked?}
    B -- yes --> L[LOGIN: establishSession]
    B -- no --> C{email present?}
    C -- no --> D1[DENY EMAIL_MISSING]
    C -- yes --> E{email verified by IdP?}
    E -- no --> D2[DENY EMAIL_NOT_VERIFIED]
    E -- yes --> F{email already used by a user?}
    F -- yes --> D3[DENY ACCOUNT_LINK_REQUIRED]
    F -- no --> N[CREATE_ACCOUNT inactive + CUSTOMER, no session]
    L --> G{account active?}
    G -- no --> D4[ACCOUNT_INACTIVE / ACCOUNT_DISABLED]
    G -- yes --> OK[session]
```

## Error codes returned to the SPA (`?status=error&code=`)
`ACCESS_DENIED` (user cancelled), `AUTH_FAILED`, `EMAIL_MISSING`, `EMAIL_NOT_VERIFIED`,
`ACCOUNT_LINK_REQUIRED`, `ACCOUNT_PENDING_ACTIVATION`, `ACCOUNT_INACTIVE`, `ACCOUNT_DISABLED`.
Never include IdP messages, tokens or e-mail in the URL.

## Configuration (`.env`)
| Variable | Description |
|---|---|
| `API_PUBLIC_URL` | Public base URL of the API (used to build redirect URIs). HTTPS required except `localhost`. |
| `APP_BASE_URL` | SPA base URL (already used by AA01). |
| `OIDC_TRANSACTION_TTL_MINUTES` | Lifetime of the login transaction. Default `10`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Provider enabled only if both are set. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Tenant GUID or `consumers`. `common`/`organizations` are rejected. |

Redirect URI to register at each IdP: `{API_PUBLIC_URL}/api/v1/auth/external/{provider}/callback`.