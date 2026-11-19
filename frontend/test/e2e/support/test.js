import { test as base, expect } from '@playwright/test';
import { GUEST_PERMISSIONS } from './sessions.js';

/**
 * `test` for every e2e spec: answers, by default, the requests any page makes when it starts,
 * so a spec only mocks what it is about:
 * - POST /auth/refresh -> 401 (no session; a spec that needs one mocks it or logs in);
 * - GET /auth/guest-permissions -> the Guest permissions;
 * - GET /health -> ok;
 * - anything else under /api/v2 -> 404 (fails fast, without a global error toast).
 * It is registered before the spec's own routes, so those always take precedence.
 */
export const test = base.extend({
  apiDefaults: [
    async ({ page }, use) => {
      await page.route('**/api/v2/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/auth/refresh')) {
          return route.fulfill({
            status: 401,
            json: { error: { status: 401, code: 'REFRESH_INVALID' } },
          });
        }
        if (path.endsWith('/auth/guest-permissions')) {
          return route.fulfill({ json: { permissions: GUEST_PERMISSIONS } });
        }
        if (path.endsWith('/health')) {
          return route.fulfill({ json: { status: 'ok' } });
        }
        return route.fulfill({
          status: 404,
          json: { error: { status: 404, code: 'NOT_FOUND' } },
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
