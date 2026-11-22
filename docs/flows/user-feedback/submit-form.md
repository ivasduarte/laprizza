# WEB04 UC1 - Submit a Form

| Attribute | Value |
|---|---|
| C4 view | Dynamic diagram, Level 3 (Component) |
| SAD view | Process View, Level 3 |
| Containers | Web Application, Back-end API, Database |
| Endpoints | The API route of the form. Example: `POST /customers` (create) or `PATCH /customers/{id}` (edit) of the Customers page |
| Allowed roles | The write permission of the form (example: `customers:write`, MANAGER); the form is only rendered with it (WEB03) |
| Success response | 201 Created / 200 OK with the saved resource; the page shows a success toast ("Customer … created.") and the saved data |
| Error handling | Client violations: shown on the fields, no request. 400 `details[{ field, type, message, limit? }]`: shown on the fields and in the summary. 409 (e-mail or phone already in use): shown on the field concerned. 404: feature text. Network, timeout, 5xx, 403: global toast ([UC4](./recover-from-failure.md)). In every failure the typed values are kept |
| ADRs | [ADR-0055](../../adr/0055-ui-consistency-and-input-validation-after-the-sprint-2-review.md), [ADR-0019](../../adr/0019-internationalization-of-the-web-application-%28english-and-portuguese%29.md) |

## Description

The user fills a form and saves it. The Customers form (`customers-form.jsx`) is the example; every form of the SPA uses the same modules.

1. **Client validation.** `validateForm(values, SCHEMA)` applies the rules of each field (for a customer: required name with the person-name pattern, e-mail, Portuguese phone number, address with place names and maximum lengths). Each rule returns `{ type, limit? }`, the same descriptor the API uses. With any violation, `useFieldErrors` stores the map, the first invalid input receives the focus, the text appears under each field (`FieldError`, `aria-invalid`, `aria-describedby`) and in the summary at the top (`FormErrors`, "Please correct the following fields." with links to the inputs). No request is sent.
2. **One submission at a time.** `useSubmit().submit(action, { successKey })` runs the request inside a `SubmitGuard`: a second click while a run is in progress is ignored (`skipped`), and the button is disabled while `submitting`.
3. **Request.** The generated hook (Orval) calls the single `HttpClient`: `onRequestStart` increments the pending counter that drives `GlobalProgress` ([UC3](./wait-for-information.md)); writes have a 30 s timeout.
4. **Back end.** The route checks the permission and validates the body with Joi (`abortEarly: false`); every violation becomes a `details` entry built by `joiDetails` (`field`, `type`, a technical `message` without the submitted value, `limit`), answered as 400 by `errorHandler`. The service then applies the domain rules (for a customer, the address check and the unique e-mail and phone, 409).
5. **Success.** `submit` resolves `{ ok: true }`, the store shows a success toast (3 s, paused on hover or focus), the cached list is invalidated and the page shows the saved data.
6. **Failure.** `normalizeError` turns the `ApiError` into a `kind`. A `validation` error is mapped to the fields (`fromApi`), with the text of `feedback.validation.<type>`; a 409 of the Customers form is mapped to the e-mail or phone field after a search (`customerFieldErrors`). Errors that no form can explain (network, timeout, 5xx, 403) are global: they are reported once as a toast by the `ErrorReporter` ([UC4](./recover-from-failure.md)) and not repeated in the form. The form values are never cleared, and a failed operation is never shown as completed.

## Diagram

```mermaid
---
title: "WEB04 UC1 - Submit a Form - C4 Dynamic, Level 3 (Component)"
---
sequenceDiagram
    autonumber
    actor user as System User<br/>[Person]
    box rgba(150,180,120,0.15) Web Application [Container: React, Vite]
        participant page as CustomersForm<br/>[Component: React page]
        participant validators as validators<br/>[Component: JS module]
        participant submit as useSubmit / SubmitGuard<br/>[Component: React hook]
        participant http as HttpClient<br/>[Component: JS module]
        participant feedback as FeedbackStore / ToastRegion<br/>[Component: JS store, React]
    end
    box rgba(120,150,200,0.15) Back-end API [Container: Node.js, Express]
        participant route as Route (Joi & Permissions)<br/>[Component: customers.routes.js]
        participant service as CustomersService<br/>[Component: Service]
        participant handler as errorHandler<br/>[Component: Express middleware]
    end
    participant db as Database<br/>[Container: MongoDB]

    activate user
    user->>page: Fills the form and clicks Save
    activate page
    page->>validators: validateForm(values, SCHEMA)
    validators-->>page: { [field]: { type, limit? } } or {}
    alt Client violations
      page-->>user: Text under each field, summary with links, focus on the first invalid input (no request)
    else Valid
      page->>submit: submit(() => createCustomer(data), { successKey: "customers.created" })
      activate submit
      opt A run is already in progress
        submit-->>page: { ok: false, skipped: true } (second click ignored)
      end
      submit->>http: POST /customers (generated hook)
      activate http
      http->>feedback: onRequestStart: pending + 1 (progress bar)
      http->>route: POST /customers, Bearer token
      activate route
      route->>route: requirePermission(customers:write), Joi createCustomerSchema (abortEarly false)
      alt Joi violations
        route->>handler: AppError 400, joiDetails(error)
        handler-->>http: 400 { error: { code, message, details[{ field, type, message, limit? }] } }
      else Valid body
        route->>service: createCustomer(data)
        activate service
        service->>service: Domain rules (address, phone)
        service->>db: Insert
        db-->>service: Customer, or duplicate key
        service-->>route: Customer DTO, or AppError 400 / 409
        deactivate service
        alt Domain error
          route->>handler: AppError
          handler-->>http: 400 / 409 { error: { status, code, message } }
        else Saved
          route-->>http: 201 Created (customer)
        end
      end
      deactivate route
      http->>feedback: onRequestEnd: pending - 1
      alt 2xx
        http-->>submit: Customer
        submit->>feedback: notify(success, "customers.created")
        submit-->>page: { ok: true, value }
        page-->>user: Success toast (3 s) and the saved customer
      else 400 / 409
        http-->>submit: ApiError(status, code, details)
        submit-->>page: { ok: false, error: normalizeError(...) } (kind validation or conflict)
        page->>page: fromApi(error) or customerFieldErrors (409 → e-mail or phone field)
        page-->>user: Errors on the fields and in the summary, typed values kept
      else Network, timeout, 5xx, 403
        http->>feedback: onError → ErrorReporter: global error toast (see UC4)
        http-->>submit: ApiError
        submit-->>page: { ok: false, error } (global, not repeated in the form)
        page-->>user: Toast, typed values kept, Save enabled again
      end
      deactivate http
      deactivate submit
    end
    deactivate page
    deactivate user
```

See the [README](./README.md) for the error contract, the notation key and the element catalogue.
