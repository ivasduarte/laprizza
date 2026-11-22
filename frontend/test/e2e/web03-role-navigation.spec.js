import { test, expect } from './support/test.js';
import { GUEST_PERMISSIONS, SESSIONS } from './support/sessions.js';

/**
 * WEB03 - role-based navigation, end to end in a real browser.
 * The back end is simulated: /auth/refresh answers with the persona's session (as a valid refresh
 * cookie would), so opening a URL directly is exactly "typing it in the address bar".
 */

// The menu is always behind the ☰ button (every width); the tests open it before reading it.
test.use({ viewport: { width: 1440, height: 900 } });

/** Mocks the API for one persona (null = Guest). Returns a setter to change the user later. */
async function mockBackend(page, persona) {
  let session = persona ? SESSIONS[persona] : null;
  const calls = [];

  // Lowest priority (registered first): anything not mocked below answers 404 immediately.
  await page.route('**/api/v2/**', (route) => {
    calls.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 404,
      json: { error: { status: 404, code: 'NOT_FOUND' } },
    });
  });
  await page.route('**/api/v2/health', (route) =>
    route.fulfill({ json: { status: 'ok' } })
  );
  await page.route('**/api/v2/auth/guest-permissions', (route) =>
    route.fulfill({ json: { permissions: GUEST_PERMISSIONS } })
  );
  await page.route('**/api/v2/auth/refresh', (route) =>
    session
      ? route.fulfill({ json: session })
      : route.fulfill({
          status: 401,
          json: { error: { status: 401, code: 'REFRESH_INVALID' } },
        })
  );
  await page.route('**/api/v2/auth/me', (route) =>
    route.fulfill({ json: session.user })
  );
  // Data of the pages that may open (empty lists are enough here).
  for (const path of [
    'kitchen-configurations',
    'assembly-line-configurations',
    'shared-resources',
  ]) {
    await page.route(`**/api/v2/${path}`, (route) => {
      calls.push(new URL(route.request().url()).pathname);
      return route.fulfill({ json: [] });
    });
  }

  return {
    calls,
    setUser(user) {
      session = { ...session, user };
    },
  };
}

const menu = (page) => page.locator('.layout-nav').getByRole('link');
const openMenu = (page) =>
  page.locator('.layout-nav').getByRole('button', { name: /open menu/i }).click();
const pageTitle = (page) => page.getByRole('heading', { level: 1 }).first();

const MENUS = {
  GUEST: ['Home'],
  CUSTOMER: ['Home', 'Shared resources'],
  NO_ROLES: ['Home'],
  // The staff consults the kitchen (configurations and 3D viewer) read-only (Table 1).
  EMPLOYEE: ['Home', '3D Visualization', 'Kitchen Configuration', 'Shared resources'],
  MANAGER: [
    'Home',
    '3D Visualization',
    'AI',
    'Kitchen Configuration',
    'Shared resources',
  ],
  MANAGER_EMPLOYEE: [
    'Home',
    '3D Visualization',
    'AI',
    'Kitchen Configuration',
    'Shared resources',
  ],
};

test.describe('WEB03 - menu follows the permissions of the session', () => {
  for (const [persona, links] of Object.entries(MENUS)) {
    test(`${persona} sees only the sections they may use`, async ({ page }) => {
      await mockBackend(page, persona === 'GUEST' ? null : persona);
      await page.goto('/');
      await openMenu(page);
      await expect(menu(page)).toHaveText(links);
    });
  }
});

/** [persona, URL typed by hand, expected outcome]. */
const DIRECT_ACCESS = [
  ['GUEST', '/ai', 'login'],
  ['GUEST', '/kitchen-configurations', 'login'],
  ['GUEST', '/shared-resources', 'login'],
  ['CUSTOMER', '/ai', 'denied'],
  ['CUSTOMER', '/kitchen-configurations', 'denied'],
  ['CUSTOMER', '/shared-resources', 'allow'],
  ['CUSTOMER', '/visualization3d', 'denied'],
  ['NO_ROLES', '/kitchen-configurations', 'denied'],
  ['EMPLOYEE', '/ai', 'denied'],
  ['EMPLOYEE', '/kitchen-configurations', 'allow'],
  ['EMPLOYEE', '/visualization3d', 'allow'],
  ['EMPLOYEE', '/shared-resources', 'allow'],
  ['MANAGER', '/ai', 'allow'],
  ['MANAGER', '/kitchen-configurations', 'allow'],
  ['MANAGER_EMPLOYEE', '/ai', 'allow'],
];

test.describe('WEB03 - typing a URL never bypasses the permissions', () => {
  for (const [persona, path, outcome] of DIRECT_ACCESS) {
    test(`${persona} opening ${path} -> ${outcome}`, async ({ page }) => {
      const { calls } = await mockBackend(
        page,
        persona === 'GUEST' ? null : persona
      );
      await page.goto(path);

      if (outcome === 'login') {
        await expect(page).toHaveURL(/\/login$/);
        return;
      }
      if (outcome === 'denied') {
        await expect(pageTitle(page)).toHaveText(/access denied/i);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        // The protected page never loaded its data.
        const pageApi = path.replace('/', '');
        expect(calls.filter((call) => call.includes(pageApi))).toEqual([]);
        return;
      }
      await expect(pageTitle(page)).toBeVisible();
      await expect(pageTitle(page)).not.toHaveText(/access denied/i);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }

  test('after login, a Guest returns to the page that was asked for', async ({
    page,
  }) => {
    await mockBackend(page, null);
    await page.route('**/api/v2/auth/login', (route) =>
      route.fulfill({ json: SESSIONS.MANAGER })
    );

    await page.goto('/kitchen-configurations');
    await expect(page).toHaveURL(/\/login$/);
    await page.fill('input[type="email"]', 'admin@laprizza.pt');
    await page.fill('input[type="password"]', 'StrongPassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/kitchen-configurations$/);
    await expect(pageTitle(page)).not.toHaveText(/access denied/i);
  });
});

test.describe('WEB03 - access denied and not found pages', () => {
  test('the access-denied page is generic and offers the way home', async ({
    page,
  }) => {
    await mockBackend(page, 'CUSTOMER');
    await page.goto('/ai');

    await expect(pageTitle(page)).toHaveText(/access denied/i);
    const main = page.locator('main');
    await expect(main).not.toContainText(/planning|manager|planning:execute/i);
    await main.getByRole('link', { name: /home page/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('an unknown URL shows the not-found page, with or without a session', async ({
    page,
  }) => {
    await mockBackend(page, 'EMPLOYEE');
    await page.goto('/this-page-does-not-exist');
    await expect(pageTitle(page)).toHaveText(/page not found/i);
    await openMenu(page);
    await expect(menu(page).first()).toBeVisible();
  });
});

test.describe('WEB03 - role changes apply without a new login', () => {
  test('losing a permission while on the page shows access denied and updates the menu', async ({
    page,
  }) => {
    const backend = await mockBackend(page, 'MANAGER_EMPLOYEE');
    await page.goto('/ai');
    await expect(pageTitle(page)).not.toHaveText(/access denied/i);

    // The manager role is removed on the back end; the user comes back to the tab.
    backend.setUser(SESSIONS.EMPLOYEE.user);
    await Promise.all([
      page.waitForResponse('**/api/v2/auth/me'),
      page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }),
    ]);

    await expect(pageTitle(page)).toHaveText(/access denied/i);
    await openMenu(page);
    await expect(menu(page)).toHaveText(MENUS.EMPLOYEE);
  });
});
