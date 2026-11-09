import { test, expect } from '@playwright/test';

const mockManagerSession = {
  accessToken: 'fake-jwt-token',
  user: { id: '1', email: 'admin@laprizza.pt', role: 'MANAGER' },
};

const mockEmployeeSession = {
  accessToken: 'fake-jwt-token',
  user: { id: '2', email: 'emp@laprizza.pt', role: 'EMPLOYEE' },
};

const mockFiles = [
  { name: 'manual.pdf', size: 2048, updatedAt: '2026-11-07T10:00:00Z' },
  { name: 'relatorio.md', size: 500, updatedAt: '2026-11-08T15:30:00Z' },
];

const LIST_URL = '**/api/v1/shared-resources';
const FILE_URL = '**/api/v1/shared-resources/*';

async function loginAndOpenSharedResources(page, email) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'StrongPassword123!');
  await Promise.all([
    page.waitForResponse('**/api/v1/auth/login'),
    page.click('button[type="submit"]'),
  ]);
  await page.getByRole('link', { name: 'Shared resources' }).click();
}

test.describe('Shared Resources Page E2E', () => {
  test('RBAC: Employee gets a read-only view (can download, cannot upload or delete)', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockEmployeeSession });
    });
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: mockFiles });
    });

    await loginAndOpenSharedResources(page, 'emp@laprizza.pt');

    await expect(page.getByText('manual.pdf')).toBeVisible();
    await expect(page.getByText('relatorio.md')).toBeVisible();
    await expect(
      page.getByText('Only managers can add or remove them.')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download manual.pdf' })
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Upload file' })).toHaveCount(
      0
    );
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  });

  test('List: shows an explicit empty state when there are no files', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: [] });
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await expect(
      page.getByText('There are no shared files yet.')
    ).toBeVisible();
  });

  test('List: a server error shows a generic message and a retry button', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    let failList = true;
    await page.route(LIST_URL, async (route) => {
      if (failList) {
        await route.fulfill({
          status: 500,
          json: { error: { message: 'Internal Server Error' } },
        });
      } else {
        await route.fulfill({ json: mockFiles });
      }
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await expect(page.getByRole('alert')).toContainText(
      'Something went wrong',
      {
        timeout: 15_000,
      }
    );
    await expect(page.getByText('Internal Server Error')).toHaveCount(0);

    failList = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('manual.pdf')).toBeVisible();
  });

  test('Download: downloads the file with its original name', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockEmployeeSession });
    });
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: mockFiles });
    });
    await page.route(FILE_URL, async (route) => {
      await route.fulfill({ body: 'conteudo', contentType: 'application/pdf' });
    });

    await loginAndOpenSharedResources(page, 'emp@laprizza.pt');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download manual.pdf' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('manual.pdf');
  });

  test('Manager Flow: Uploads a new file as raw binary and refreshes the list', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });

    let files = [...mockFiles];
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: files });
    });

    let uploadRequest = null;
    await page.route(FILE_URL, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      uploadRequest = route.request();
      files = [
        ...files,
        { name: 'menu.txt', size: 12, updatedAt: '2026-11-09T12:00:00Z' },
      ];
      await route.fulfill({
        status: 201,
        json: { name: 'menu.txt', size: 12 },
      });
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await page.setInputFiles('input[type="file"]', {
      name: 'menu.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Pizza do dia'),
    });
    await page.getByRole('button', { name: 'Upload file' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: '“menu.txt” was uploaded.' })
    ).toBeVisible();
    await expect(page.getByText('menu.txt').first()).toBeVisible();

    expect(uploadRequest.url()).toContain('/shared-resources/menu.txt');
    expect(uploadRequest.headers()['content-type']).toBe(
      'application/octet-stream'
    );
    expect(uploadRequest.postDataBuffer()?.toString()).toBe('Pizza do dia');
  });

  test('Manager Flow: Warns before replacing an existing file', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: mockFiles });
    });
    await page.route(FILE_URL, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      await route.fulfill({
        status: 200,
        json: { name: 'manual.pdf', size: 3 },
      });
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await page.setInputFiles('input[type="file"]', {
      name: 'manual.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf'),
    });

    await expect(
      page.getByText(
        'A file with this name already exists and will be replaced.'
      )
    ).toBeVisible();
    await page.getByRole('button', { name: 'Replace file' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: '“manual.pdf” was replaced.' })
    ).toBeVisible();
  });

  test('Manager Flow: Rejects a disallowed file type without calling the API', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: mockFiles });
    });

    let uploadCalled = false;
    await page.route(FILE_URL, async (route) => {
      if (route.request().method() === 'PUT') uploadCalled = true;
      await route.fallback();
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await page.setInputFiles('input[type="file"]', {
      name: 'script.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'),
    });
    await page.getByRole('button', { name: 'Upload file' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'This file type is not allowed.'
    );
    expect(uploadCalled).toBe(false);
  });

  test('Manager Flow: Deletes a file after confirmation', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });

    let files = [...mockFiles];
    await page.route(LIST_URL, async (route) => {
      await route.fulfill({ json: files });
    });
    await page.route(FILE_URL, async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      files = files.filter((f) => f.name !== 'manual.pdf');
      await route.fulfill({ status: 204 });
    });

    await loginAndOpenSharedResources(page, 'admin@laprizza.pt');

    await page.getByRole('button', { name: 'Delete manual.pdf' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Delete “manual.pdf”? This cannot be undone.'
    );
    await page.getByRole('button', { name: 'Delete file' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: '“manual.pdf” was deleted.' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download manual.pdf' })
    ).toHaveCount(0);
  });
});
