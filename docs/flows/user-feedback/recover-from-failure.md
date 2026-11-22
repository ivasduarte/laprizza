# WEB04 UC4 - Recover from a Failure

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API |
| Endpoints | Any request of the Web Application. Examples: `GET /customers` (read) and `POST /customers` (write) |
| Allowed roles | Any user |
| Success response | The retried request answers 200 and the page shows the data |
| Error handling | This use case is the error handling of the others: network failure, timeout (15 s reads, 30 s writes), 5xx, 403, 429, an expired access token |
| ADRs | [ADR-0055](../../adr/0055-ui-consistency-and-input-validation-after-the-sprint-2-review.md), [ADR-0043](../../adr/0043-secure-session-handling-in-the-api-and-the-spa.md) |

## Description

A request fails. The user must understand what happened without seeing internal details, and must be able to try again safely.

1. **One error type.** The `HttpClient` turns every failure into an `ApiError` with `status`, `code`, `details` (only kept for validation errors), `retryAfterSeconds` (from `Retry-After`) and `outcomeUnknown`. No answer is `NETWORK_ERROR` (status 0) and a request that exceeds its limit is `TIMEOUT`; both are marked `outcomeUnknown` when the request was a write, because it may have been executed. The body of a 5xx carries only the generic status text: the back end never sends `details` or stack traces (`errorHandler`).
2. **Expired session.** A 401 with `TOKEN_EXPIRED` refreshes the access token once (refresh cookie) and repeats the request; if that fails, the session ends and the login page explains it (AA04).
3. **Classification.** `normalizeError` gives the `kind`: `network`, `timeout`, `server` and `forbidden` are global (no form can explain them); the others are explained where the request was made.
4. **Global errors.** The `HttpClient` calls `onError` once per failed request (never for an abort); the `ErrorReporter` turns a global error into one error toast, translated by `kind` ("Could not reach the server. Check your connection.", "The server took too long to respond.", "The server could not complete the request. Please try again later.", "You do not have permission to perform this action."). Identical toasts are not stacked. A 403 also reloads the user, so the menu and the buttons follow the current permissions (WEB03). Requests marked `feedback: "silent"` (for example `GET /auth/me`) never raise a toast.
5. **A failed write.** The form keeps its values and is not shown as completed. When the outcome is unknown, the message adds "The operation may have been completed. Check the current data before trying again." and the page invalidates its cached data, so the next view shows the real state before the user repeats the action.
6. **A failed read.** `QueryState` shows "The data could not be loaded." with **Try again**, which repeats the query (disabled while it runs). A 400 is not retried, because it would fail the same way. When a refresh fails, the last data stays on screen below the error. A 429 adds the waiting time taken from `Retry-After`.

## Diagram

```mermaid
---
title: "WEB04 UC4 - Recover from a Failure - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as Feature page<br/>[Component: React page]
        participant query as QueryState<br/>[Component: React component]
        participant http as HttpClient<br/>[Component: JS module]
        participant normalizer as ErrorNormalizer / ErrorText<br/>[Component: JS modules]
        participant reporter as ErrorReporter / FeedbackStore / ToastRegion<br/>[Component: JS modules, React]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant api as Route and errorHandler<br/>[Component: Express router and middleware]
    end

    activate user
    user->>page: Opens a list or saves a form
    activate page
    page->>http: request(path, options)
    activate http
    http->>api: HTTP request (timeout 15 s read, 30 s write)
    activate api
    alt No answer or timeout
      api--xhttp: Connection refused / no answer in time
      http->>http: ApiError NETWORK_ERROR or TIMEOUT (status 0), outcomeUnknown when it is a write
    else 401 TOKEN_EXPIRED
      api-->>http: 401
      http->>api: POST /auth/refresh, then the same request once
      api-->>http: Answer of the retried request (or the session ends, AA04)
    else 5xx
      api-->>http: { error: { status, code, message: generic status text } } (no details)
      http->>http: ApiError(status, code)
    end
    deactivate api
    http->>reporter: onError(error) (once, never on abort)
    activate reporter
    reporter->>normalizer: normalizeError(error)
    normalizer-->>reporter: { kind, global, outcomeUnknown, retryAfterSeconds, ... }
    opt global (network, timeout, server, forbidden) and not "silent"
      reporter->>normalizer: errorMessage(t, error): text by kind, + outcomeUnknown text
      reporter-->>user: One error toast (not stacked twice), 403 also reloads the user (WEB03)
    end
    deactivate reporter
    http-->>page: throw ApiError
    deactivate http
    alt Failed write (form)
      page-->>user: Values kept, not shown as completed
      opt outcomeUnknown
        page->>page: Invalidate the cached data (the next view shows the real state)
      end
    else Failed read (list or detail)
      page->>query: QueryState(error)
      activate query
      query-->>user: "The data could not be loaded." + Try again (no button for a 400), last data kept on a failed refresh
      user->>query: Try again
      query->>page: query.refetch() (button disabled while fetching)
      Note over query,api: Same flow as UC3, on success the data replaces the error
      deactivate query
    end
    deactivate page
    deactivate user
```

See the [README](./README.md) for the error contract, the notation key and the element catalogue.
