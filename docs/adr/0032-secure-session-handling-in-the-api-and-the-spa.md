# Secure Session Handling in the API and the SPA

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-16

Technical Story: [AA04] Secure Session Handling

## Context and Problem Statement

[ADR 0011](./0011-implement-refresh-tokens-for-secure-sessions.md) introduced a short-lived access token, plus a rotating refresh token in an `HttpOnly` cookie, backed by the `AuthSession`collection. 

AA04 asks for more than a valid token: the session must be checked on every protected operation; an ended session must never be reusable; nothing about the session may leak (URLs, messages, logs); and going back to a page after logout must not reveal protected information.

After ADR 0011, the following gaps remained:

- Only `/auth/*` and `/health` sent `Cache-Control: no-store`;
- Two tabs refreshing at the same time could trigger the reuse detection and revoke a healthy session;
- The SPA kept user data in memory after the session ended and had no central route guard;
- Disabling an account relied only on `tokenVersion`, leaving the `AuthSession` records formally active.

## Decision Drivers

* Meet every AA04 acceptance criterion with evidence;
* Keep the server as the only authority: the SPA never decides who is authorized;
* No new infrastructure or dependencies;
* Local and external (OIDC) authentication must end in the same session.


| # | Decision | Where |
|:--|:---------|:------|
| D1 | Every API response carries `Cache-Control: no-store`(middleware applied to `/api`). Caching of the SPA shell (`index.html`) is a web server concern. | Backend, `no-store` middleware |
| D2 | Token refresh is serialized across tabs with a Web Lock (`laprizza-token-refresh`). Without Web Locks (insecure context) it falls back to one refresh per tab. | SPA, `refresh-lock.js` |
| D3 | When a session ends in one tab, the others end theirs through a `BroadcastChannel` (`laprizza-session`). Only the event is sent, never tokens or user data. | SPA, `session-sync.js` |
| D4 | Data fetched during a session never outlives it: the query cache is cleared when the session ends or the user changes, and the page is reloaded when the browser restores it from the back/forward cache. | SPA, `session-cache.js`, `session-sync.js` |
| D5 | Protected pages are rendered by a route guard driven by a `requiresAuth` flag in the feature registry. After login the user returns to the requested page through `safeRedirectPath` (same-app absolute paths only). | SPA, `require-auth.jsx`, `redirect.js` |
| D6 | Logout requires a valid access token and revokes the session identified by its `sid`. If the token is expired, the HTTP client refreshes it and retries before the logout request. | Back end routes, SPA `http-client.js` |
| D7 | Disabling an account or changing its password increments `tokenVersion`, and the persisted sessions of the user are revoked. Roles are read from the database on every request, so role changes apply immediately without touching sessions. | Back end, users and auth services |
| D8 | The `sessionId` is kept in security log events. It identifies a record but grants nothing without the signed token. Values whose key matches `pass`, `token`, `secret`, `cookie`, `authorization` or `hash` are dropped by the security logger. | Back end, security logger |
| D9 | Idle timeout on top of the absolute expiry (revised 2026-11-21, see below). A session not used for `SESSION_IDLE_TIMEOUT_MINUTES` (30 by default, 0 disables it) is refused: `rotateRefreshToken` only matches sessions with `lastUsedAt` inside the window and `isSessionUsable` applies the same rule to every protected request. Protected requests refresh `lastUsedAt` at most once per minute. The refresh token keeps its absolute lifetime (`REFRESH_TOKEN_TTL_DAYS`, 7 by default) and the access token 60 minutes. | Back end, `auth.domain.js`, `auth.service.js`, `auth-sessions.repository.js` |
| D10 | Staging and production are served over HTTPS (nginx, port 80 redirects). The `Secure` refresh cookie and the Web Locks of D2 need a secure context; outside `localhost`, HTTP would end the session on every reload. | `deploy/nginx/laprizza.conf`, [HTTPS](../sys-admin/https.md) |

## Considered Options

* Keep the ADR 0011 model and close the gaps
* Replace it with opaque server-side sessions only
* Add an idle timeout on top of the absolute expiry

## Decision Outcome

Chosen option: "Keep the ADR 0011 model and close the gaps", because the model already revalidates the user and the session on every request, and the remaining problems are local and cheap to fix.

### Positive Consequences

* A revoked, expired or tampered session is refused on the next request, without waiting for the access token to expire.
* Logout in one tab ends the session everywhere, and the back button doesn't show protected data.
* One decision record maps each AA04 criterion to code and tests (see [Session Handling](../flows/authentication/session-handling.md)).

### Negative Consequences

* `no-store` disables HTTP caching of API reads. Server-side caching is covered by [ADR 0015](./0015-introduce-redis-for-caching.md).
* Every protected request reads the user and the session from the database.
* Web Locks and `BroadcastChannel` don't exist in old browsers or insecure contexts. The SPA degrades to the previous behaviour in that case.
* A user who leaves the application open without any request for longer than the idle window must sign in again (no warning is shown before it ends).

## Pros and Cons of the Options

### Keep the ADR 0011 model and close the gaps

* Good, because the changes are small, isolated and testable.
* Good, because local and external authentication share `establishSession`, so they end in the same kind of session.
* Bad, because the SPA must coordinate tabs, which adds browser-API dependencies.

### Replace it with opaque server-side sessions only

(See [ADR 0011](./0011-implement-refresh-tokens-for-secure-sessions.md))

* Good, because the browser guarantees one holder at a time across tabs, with no polling.
* Bad, because it needs a secure context (HTTPS or `localhost`).

*Alternatives considered for D2: A grace window on the backend that accpets a just-rotated token (rejected, it weakens the reuse detection) and a leader-tab election (rejected, more code than a lock).*

### Add an idle timeout on top of the absolute expiry

* Good, because it shortens the exposure of abandoned sessions.
* Good, because it reuses `lastUsedAt` (already stored): no sliding `expiresAt` is needed.
* Bad, because it adds one write per minute per active session.

**Revision 2026-11-21:** the AA04 clarification requires the session to survive a reload or a new tab "as long as it has not expired through inactivity", so this option was added to the chosen one (D9). The idle timeout complements, and does not replace, the model kept above.
