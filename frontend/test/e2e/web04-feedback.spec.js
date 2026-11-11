import { test, expect } from '@playwright/test';

const managerSession = {
  accessToken: 'fake-jwt-token',
  user: { id: '1', email: 'admin@laprizza.pt', roles: ['MANAGER'] },
};

const configs = [
  {
    id: '1',
    name: 'Standard Layout',
    isActive: true,
    content: { dimensions: { width: 10, length: 15, height: 3 }, elements: [] },
  },
  {
    id: '2',
    name: 'Automated Line',
    isActive: false,
    content: { dimensions: { width: 12, length: 20, height: 4 }, elements: [] },
  },
];

async function mockBackend(page) {
  // Lowest priority (routes registered last win): requests nobody mocks must not hang and keep
  // the global loader on. The silent session refresh at start answers "no session".
  await page.route('**/api/v1/**', (route) =>
    route.request().url().endsWith('/auth/refresh')
      ? route.fulfill({
          status: 401,
          json: { error: { status: 401, code: 'REFRESH_TOKEN_INVALID' } },
        })
      : route.fulfill({
          status: 404,
          json: { error: { status: 404, code: 'NOT_FOUND' } },
        })
  );
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ json: managerSession })
  );
  await page.route('**/api/v1/kitchen-configurations', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: configs });
    return route.fallback();
  });
  await page.route('**/api/v1/kitchen-configurations/active', (route) =>
    route.fulfill({ json: configs[0] })
  );
}

async function openKitchenConfigs(page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@laprizza.pt');
  await page.fill('input[type="password"]', 'StrongPassword123!');
  await Promise.all([
    page.waitForResponse('**/api/v1/auth/login'),
    page.click('button[type="submit"]'),
  ]);
  await page.getByRole('link', { name: 'Kitchen Configuration' }).click();
}

test.describe('WEB04 - user feedback and validation', () => {
  test('empty required fields are explained next to the input, without a request', async ({
    page,
  }) => {
    let loginRequests = 0;
    await page.route('**/api/v1/auth/login', (route) => {
      loginRequests += 1;
      return route.fulfill({ json: managerSession });
    });

    await page.goto('/login');
    await page.click('button[type="submit"]');

    await expect(page.locator('#login-email')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(page.locator('#login-email-error')).toHaveText(
      'This field is required.'
    );
    await expect(page.locator('#login-email')).toBeFocused();
    expect(loginRequests).toBe(0);
  });

  test('valid submit: loading indicator, disabled button, one request, success toast', async ({
    page,
  }) => {
    await mockBackend(page);
    let posts = 0;
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
      return route.fulfill({ status: 201, json: { ...configs[1], id: '3' } });
    });

    await openKitchenConfigs(page);
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.fill('input#config-name', 'New layout');

    const save = page.getByRole('button', { name: 'Save Configuration' });
    await save.dblclick(); // double click must not send two requests

    await expect(
      page.getByRole('button', { name: 'Saving...' })
    ).toBeDisabled();
    await expect(
      page.locator('.global-progress[data-active="true"]')
    ).toBeAttached();
    await expect(
      page.locator('p[role="status"]').filter({ hasText: 'saved successfully' })
    ).toBeVisible();
    await expect(
      page.locator('.global-progress[data-active="false"]')
    ).toBeAttached();
    expect(posts).toBe(1);
  });

  test('API field errors are bound to the input and the typed value is kept', async ({
    page,
  }) => {
    await mockBackend(page);
    await page.route('**/api/v1/kitchen-configurations', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: 400,
        json: {
          error: {
            status: 400,
            code: 'BAD_REQUEST',
            message: 'Validation error',
            details: [
              {
                field: 'name',
                type: 'string.min',
                message: '"name" length must be at least 3',
                limit: 3,
              },
            ],
          },
        },
      });
    });

    await openKitchenConfigs(page);
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.fill('input#config-name', 'ab');
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    await expect(page.locator('#config-name-error')).toHaveText(
      'Use at least 3 characters.'
    );
    await expect(page.locator('#config-name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(page.locator('#config-name')).toHaveValue('ab');
    // the technical English message is never shown
    await expect(page.getByText('length must be at least')).toHaveCount(0);
    // the operation is not presented as completed
    await expect(page.getByText('saved successfully')).toHaveCount(0);
  });

  test('a 500 shows a generic toast and never the internal details', async ({
    page,
  }) => {
    await mockBackend(page);
    await page.route('**/api/v1/kitchen-configurations', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: 500,
        json: {
          error: {
            status: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'TypeError at /srv/app/db.js:42',
          },
        },
      });
    });

    await openKitchenConfigs(page);
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.fill('input#config-name', 'Layout');
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    const toast = page.locator('.toast-error p[role="alert"]');
    await expect(toast).toContainText('could not complete the request');
    await expect(page.getByText('/srv/app/db.js')).toHaveCount(0);
    await expect(page.locator('#config-name')).toHaveValue('Layout');
    await expect(
      page.getByRole('button', { name: 'Save Configuration' })
    ).toBeEnabled();
  });

  test('a connection failure warns that the write may have happened and allows a safe retry', async ({
    page,
  }) => {
    await mockBackend(page);
    await page.route('**/api/v1/kitchen-configurations', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.abort('connectionreset');
    });

    await openKitchenConfigs(page);
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.fill('input#config-name', 'Layout');
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    await expect(page.locator('.toast-error p[role="alert"]')).toContainText(
      'may have been completed'
    );
    await expect(
      page.getByRole('button', { name: 'Save Configuration' })
    ).toBeEnabled();
  });

  test('updating a configuration confirms with a success toast', async ({
    page,
  }) => {
    await mockBackend(page);
    let patches = 0;
    await page.route('**/api/v1/kitchen-configurations/2', (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      patches += 1;
      return route.fulfill({ json: { ...configs[1], name: 'Renamed line' } });
    });

    await openKitchenConfigs(page);
    await page
      .locator('.kitchen-config-card:not(.active)')
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.fill('input#config-name', 'Renamed line');
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    await expect(
      page.locator('p[role="status"]').filter({ hasText: 'saved successfully' })
    ).toBeVisible();
    expect(patches).toBe(1);
  });

  test('a failed list load offers a safe retry', async ({ page }) => {
    await mockBackend(page);
    let failList = true;
    await page.route('**/api/v1/kitchen-configurations', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return failList
        ? route.fulfill({
            status: 503,
            json: { error: { status: 503, code: 'SERVICE_UNAVAILABLE' } },
          })
        : route.fulfill({ json: configs });
    });

    await openKitchenConfigs(page);
    await expect(page.locator('p[role="alert"]')).toContainText(
      'could not complete the request'
    );

    failList = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Automated Line')).toBeVisible();
  });

  test('deleting requires confirmation; cancelling sends nothing', async ({
    page,
  }) => {
    await mockBackend(page);
    let deletes = 0;
    await page.route('**/api/v1/kitchen-configurations/2', (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      deletes += 1;
      return route.fulfill({ status: 204, body: '' });
    });

    await openKitchenConfigs(page);
    const inactiveCard = page.locator('.kitchen-config-card:not(.active)');
    const dialog = page.getByRole('dialog');

    await inactiveCard.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(deletes).toBe(0);

    await inactiveCard.getByRole('button', { name: 'Delete' }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(
      page
        .locator('p[role="status"]')
        .filter({ hasText: 'deleted successfully' })
    ).toBeVisible();
    expect(deletes).toBe(1);
  });

  test('Escape closes the confirmation dialog without confirming', async ({
    page,
  }) => {
    await mockBackend(page);
    await openKitchenConfigs(page);
    await page
      .locator('.kitchen-config-card:not(.active)')
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
