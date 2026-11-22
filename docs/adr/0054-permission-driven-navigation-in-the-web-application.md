# Permission-Driven Navigation in the Web Application

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-21

Technical Story: [WEB03] Role-Based Navigation

## Context and Problem Statement

Before WEB03, the Web Application showed every menu option to every visitor, and each protected page compared role names on its own. WEB03 requires that the menu is built from the roles and permissions of the authenticated user, that unauthorized sections cannot be opened even by typing their URL, that an access-denied message is shown without revealing protected information, that the sections follow Table 1, that users with several roles get the union of their access, that role or account changes apply before further protected operations, and that hiding a menu option is always complemented by a check when the functionality is requested. AA05 already gives every request a permission check in the back end and exposes the permissions of the session (`GET /auth/me`) and of the Guest (`GET /auth/guest-permissions`) ([ADR-0053](0053-permission-based-authorization-matrix.md)).

## Decision Drivers

* One source of truth: the Web Application must never decide access with its own copy of the matrix or with role names.
* The menu, the route guard and the action buttons must agree with each other and with the API.
* Typing a URL must not show a protected page nor load its data.
* Role and status changes made in the back end must reach an open tab without a new login.
* A new page must not be published without deciding who may open it.

## Considered Options

* What the Web Application decides with: (A) the permissions returned by the back end, (B) the role names of the session, (C) a copy of the permission matrix in the Web Application.
* Where the access rule of a page lives: (A) in the page registry, as data (`permission`, `requiresAuth`), used by the menu and the route guard, (B) inside each page component.
* Unauthorized URL: (A) the "access denied" page at the same URL, (B) a redirect to the home page, (C) the "not found" page.
* Applying role changes: (A) reload the user (`GET /auth/me`) when the tab becomes visible and after any `403`, (B) only at the next login or refresh, (C) periodic polling.

## Decision Outcome

* **Permissions from the back end (A).** The session user (login, refresh, `/auth/me`) carries `roles` and `permissions`; without a session, the Guest permissions come from `/auth/guest-permissions` and are kept in their own store (`guestPermissionStore`). `usePermissions` returns the permissions of the session, or the Guest ones without a session; `useCan(permission)` answers whether one is granted. No component compares role names (checked by `no-role-names.test.js`).
* **Registry as data (A).** Each entry of `features/registry.js` declares `requiresAuth` and/or `permission`. The menu shows the entries that are in the navigation, whose session requirement is met and whose permission is granted (`visibleFeatures`). The same fields wrap the route in `RequireAuth`, so the menu and the guard cannot disagree. Buttons and forms of an action use `useCan` with the permission of its API route.
* **Route guard.** `resolveGuard(status, { requiresAuth, allowed })` answers `wait` while the session is being restored, `login` for a Guest (keeping the requested page to return to after the login), `denied` for a session without the permission and `allow` otherwise. The page component, and therefore its data requests, only loads on `allow`.
* **"Access denied" at the same URL (A).** The page is generic: a title, "You do not have permission to open this page" and a link to the home page. It never names the permission, the role or the content of the page. Unknown URLs show a "Page not found" page inside the normal layout.
* **Reload on visibility and on 403 (A).** When the tab becomes visible, and after any `403` from the API, the Web Application reloads the user with `GET /auth/me`; the menu, the guards and the buttons update at once. A `401` (`TOKEN_EXPIRED` after a failed refresh, `SESSION_REVOKED`, a disabled account) ends the session and goes to the login. The API still checks every request (AA05), so a change is enforced even before the Web Application notices it.
* **Guard-rail tests.** `registry-permissions.test.js` fails if a page is not classified (permission, session only or public) or if its permission differs from the one of its API routes; `navigation.test.js` checks the menu of every base role and of users with several roles; the Playwright suite `web03-role-navigation.spec.js` checks the menu, typed URLs, the access-denied and not-found pages and a role removed while the page is open.

### Positive Consequences

* The Web Application follows Table 1 without knowing it: a new role or a changed permission in the back end changes the menu without changing the Web Application.
* A typed URL never shows a protected page nor triggers its data requests.
* Users with several roles see exactly the union of their sections.
* A removed role is reflected as soon as the user returns to the tab or the API refuses a request.

### Negative Consequences

* Every page and action must declare the permission of its API route, and the tests must be kept up to date.
* One more request (`GET /auth/me`) each time the tab becomes visible.
* While the tab stays visible, a removed permission is only noticed when the API answers `403`.

## Pros and Cons of the Options

### Permissions from the back end

* Good, because the API and the Web Application use the same decision.
* Bad, because the Web Application depends on the back end to know what to show, even for Guests.

### Role names

* Good, because roles are easy to read.
* Bad, because every page would repeat Table 1, and users with several roles or a new role would need changes everywhere.

### Copy of the matrix in the Web Application

* Good, because no request is needed.
* Bad, because the two copies drift apart.

### Access rule inside each page

* Good, because the rule sits next to the page.
* Bad, because the menu would need a second copy of it and a page without a rule would go unnoticed.

### Redirect to the home page

* Good, because the user lands on a working page.
* Bad, because the user does not learn why, and the original URL is lost.

### "Not found" for unauthorized pages

* Good, because it does not even reveal that the page exists.
* Bad, because a user who lost a role would not understand what happened; the generic "access denied" reveals nothing about the content.

### Only at the next login or refresh

* Good, because it needs no extra request.
* Bad, because an open tab would keep showing sections the user can no longer use, for up to the life of the access token.

### Polling

* Good, because changes are noticed while the tab is visible.
* Bad, because it sends requests all the time, for changes that are rare.
