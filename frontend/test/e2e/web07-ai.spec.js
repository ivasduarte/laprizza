import { test, expect } from './support/test.js';

/**
 * WEB07 AI configuration and execution (mocked API). Covers: forecast validation and
 * versioned save, supplier import with dry-run rejection and confirmation, and no duplicate
 * submission of a calculation.
 */
const API = '**/api/*';
const MARGHERITA = 'de01b000000000000000000b';
const WATER = 'de01b00000000000000000dd';
const MOZZ = 'de01b0000000000000000003';
const SIZE_M = 'de01a0000000000000000002';
const FORECAST_ID = 'de01f0000000000000000001';

const managerSession = {
  accessToken: 'fake-jwt-token',
  user: {
    id: '1',
    email: 'admin@laprizza.pt',
    roles: ['MANAGER'],
    permissions: [
      'forecasts:read',
      'forecasts:write',
      'suppliers:read',
      'suppliers:import',
      'planning:execute',
      'products:read',
    ],
  },
};
const forecast = {
  id: FORECAST_ID,
  name: 'Semana demo',
  version: 1,
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  entries: [
    { date: '2026-12-01', productId: MARGHERITA, sizeId: SIZE_M, quantity: 10 },
    { date: '2026-12-02', productId: MARGHERITA, sizeId: SIZE_M, quantity: 25 },
  ],
  isActive: true,
};

async function mockCatalogue(page) {
  await page.route(`${API}/products?*`, (route) =>
    route.fulfill({
      json: [
        { id: MARGHERITA, name: 'Margherita', sellable: true, isActive: true },
        { id: WATER, name: 'Água', sellable: true, isActive: true },
      ],
    })
  );
  await page.route(`${API}/predefined-pizzas`, (route) =>
    route.fulfill({
      json: [
        { id: 'p1', productId: MARGHERITA, sizeIds: [SIZE_M], isActive: true },
      ],
    })
  );
  await page.route(`${API}/pizza-size`, (route) =>
    route.fulfill({ json: [{ id: SIZE_M, name: 'M' }] })
  );
  await page.route(`${API}/ai-data/products/export`, (route) =>
    route.fulfill({
      json: {
        exportedAt: '2026-11-19T10:00:00Z',
        products: [
          {
            id: MOZZ,
            name: 'Mozzarella',
            kind: 'rawMaterial',
            stockUnit: 'abstract stock unit',
            sellable: false,
          },
          {
            id: WATER,
            name: 'Água',
            kind: 'directSale',
            stockUnit: 'abstract stock unit',
            sellable: true,
          },
        ],
      },
    })
  );
}

async function login(page, session) {
  await page.route(`${API}/auth/login`, (route) =>
    route.fulfill({ json: session })
  );
  await page.goto('/login');
  await page.fill('input[type="email"]', session.user.email);
  await page.fill('input[type="password"]', 'StrongPassword123!');
  await Promise.all([
    page.waitForResponse(`${API}/auth/login`),
    page.click('button[type="submit"]'),
  ]);
}

async function openAiPage(page) {
  await page.getByRole('link', { name: 'AI', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'AI planning', level: 1 })
  ).toBeVisible();
}

test.describe('WEB07 AI page', () => {
  // Any API call a test does not mock would reach a real back end through the dev proxy and
  // get a 401 for the fake token, which ends the session mid-test. Unmocked reads answer an
  // empty list and unmocked writes a 404; each test registers its own routes on top (the
  // last registered route wins). Auth requests keep the default behaviour.
  test.beforeEach(async ({ page }) => {
    await page.route(`${API}/**`, (route) => {
      if (route.request().url().includes('/auth/')) return route.fallback();
      return route.request().method() === 'GET'
        ? route.fulfill({ json: [] })
        : route.fulfill({
            status: 404,
            json: { error: { status: 404, code: 'NOT_MOCKED' } },
          });
    });
  });

  test('forecast: client validation, then save creates a version (no version sent)', async ({
    page,
  }) => {
    await mockCatalogue(page);
    const posted = [];
    let list = [];
    await page.route(`${API}/forecasts`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        posted.push(body);
        const created = {
          ...body,
          id: 'de01f0000000000000000009',
          version: 1,
          isActive: true,
        };
        list = [created];
        return route.fulfill({ status: 201, json: created });
      }
      return route.fulfill({ json: list });
    });

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('button', { name: 'New forecast' }).click();
    await page.getByLabel('Name').fill('Natal');
    await page.getByLabel('Start date').fill('2026-12-20');
    await page.getByLabel('End date').fill('2026-12-26');
    await expect(
      page
        .getByText('Omitted entries mean zero consumption.', { exact: false })
        .first()
    ).toBeVisible();

    const entry = page.locator('.ai-entry').first();
    await entry.getByLabel('Date').fill('2026-12-27');
    await entry.getByLabel('Product').selectOption({ label: 'Água' });
    await entry.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      entry.getByText('The date is outside the forecast period.')
    ).toBeVisible();
    expect(posted).toHaveLength(0);

    await entry.getByLabel('Date').fill('2026-12-24');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: /Natal/ })).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      name: 'Natal',
      startDate: '2026-12-20',
      endDate: '2026-12-26',
      entries: [
        { date: '2026-12-24', productId: WATER, sizeId: null, quantity: 3 },
      ],
    });
  });

  test('suppliers: a rejected file keeps the dataset, a valid one is inspected and confirmed', async ({
    page,
  }) => {
    await mockCatalogue(page);
    let created = 0;
    await page.route(`${API}/supplier-scenarios`, async (route) => {
      if (route.request().method() === 'POST') {
        created += 1;
        return route.fulfill({
          status: 201,
          json: {
            id: 's1',
            ...route.request().postDataJSON(),
            version: 1,
            simulated: true,
            isActive: true,
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.route(`${API}/supplier-scenarios/validate`, async (route) => {
      const body = route.request().postDataJSON();
      if (
        body.products.some((p) => p.productId === 'ffffffffffffffffffffffff')
      ) {
        return route.fulfill({
          status: 400,
          json: {
            error: {
              status: 400,
              code: 'VALIDATION_ERROR',
              message: 'Validation failed.',
              details: [
                {
                  field: 'products[0].productId',
                  type: 'productUnknown',
                  message: 'Unknown product.',
                },
              ],
            },
          },
        });
      }
      return route.fulfill({ json: { valid: true, nextVersion: 1 } });
    });

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('tab', { name: 'Suppliers' }).click();

    const offers = (productId) => ({
      name: 'Demo',
      suppliers: [{ id: 'SUP-A', name: 'Fornecedor A' }, { id: 'SUP-B' }],
      products: [
        {
          productId,
          offers: [
            {
              supplierId: 'SUP-A',
              priceEur: 10,
              stockUnits: 50,
              leadTimeDays: 2,
            },
            {
              supplierId: 'SUP-B',
              priceEur: 9,
              stockUnits: 50,
              leadTimeDays: 4,
            },
          ],
        },
      ],
    });

    // Missing price and lead time: rejected locally, nothing reaches the server.
    await page.getByLabel('Supplier JSON').fill(
      JSON.stringify({
        name: 'Demo',
        suppliers: [{ id: 'SUP-A' }],
        products: [
          {
            productId: MOZZ,
            offers: [{ supplierId: 'SUP-A', stockUnits: 1 }],
          },
        ],
      })
    );
    await page.getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByText('products.0.offers.0.priceEur')).toBeVisible();
    await expect(
      page.getByText('The previous valid dataset is still in use.')
    ).toBeVisible();

    // Unknown product: rejected by the server dry-run.
    await page
      .getByLabel('Supplier JSON')
      .fill(JSON.stringify(offers('ffffffffffffffffffffffff')));
    await page.getByRole('button', { name: 'Inspect' }).click();
    await expect(
      page.getByText('Unknown product (or not sellable).')
    ).toBeVisible();
    expect(created).toBe(0);

    // Two offers for one product + a product without supplier, then confirm.
    await page.getByLabel('Supplier JSON').fill(JSON.stringify(offers(MOZZ)));
    await page.getByRole('button', { name: 'Inspect' }).click();
    const preview = page.getByRole('region', {
      name: 'Step 2 · Inspect and confirm',
    });
    await expect(preview.getByText('Fornecedor A')).toBeVisible();
    await expect(preview.getByText('SUP-B')).toBeVisible();
    await expect(preview.getByText('No configured supplier')).toBeVisible();
    expect(created).toBe(0);
    await preview
      .getByRole('button', { name: 'Confirm and save scenario' })
      .click();
    await expect(
      page.getByText('Supplier scenario “Demo” v1 saved.')
    ).toBeVisible();
    expect(created).toBe(1);
  });

  test('execution: one request per click burst, result saved as a run', async ({
    page,
  }) => {
    await page.route(`${API}/forecasts`, (route) =>
      route.fulfill({ json: [forecast] })
    );
    await page.route(`${API}/supplier-scenarios`, (route) =>
      route.fulfill({ json: [] })
    );
    await page.route(`${API}/planning/runs?*`, (route) =>
      route.fulfill({ json: [] })
    );
    let calls = 0;
    let body = null;
    await page.route(`${API}/planning/requirements`, async (route) => {
      calls += 1;
      body = route.request().postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        json: {
          status: 'ok',
          simulation: true,
          runId: 'run-1',
          calculatedAt: '2026-11-19T10:00:00Z',
          scenario: {
            id: 'DEMO-PARTIAL',
            name: 'Demo',
            version: 1,
            stockMode: 'live',
          },
          inputs: { snapshotId: 'snap-1' },
          plan: {
            forecastId: FORECAST_ID,
            forecastName: 'Semana demo',
            version: 1,
            startDate: '2026-12-01',
            endDate: '2026-12-03',
            referenceDate: '2026-11-19',
          },
          summary: { totalCostEur: 0, productsToBuy: 1, feasible: false },
          requirements: [
            {
              productId: MOZZ,
              name: 'Mozzarella',
              kind: 'simple',
              stockControlled: true,
              required: 7,
              available: 2,
              shortage: 5,
              needs: [{ date: '2026-12-02', quantity: 5 }],
            },
          ],
          production: [],
          purchases: [
            {
              productId: MOZZ,
              name: 'Mozzarella',
              shortage: 5,
              covered: 0,
              uncovered: 5,
              costEur: 0,
              status: 'unavailable',
              allocations: [],
              unmet: [
                {
                  date: '2026-12-02',
                  quantity: 5,
                  reason: 'NO_SUPPLIER_OFFER',
                },
              ],
            },
          ],
          warnings: [{ code: 'NO_SUPPLIER_SCENARIO' }],
        },
      });
    });

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('button', { name: 'View' }).first().click();
    await page.getByRole('button', { name: 'Run with this forecast' }).click();
    await page.getByLabel('Scenario code').fill('DEMO-PARTIAL');
    const execute = page.getByRole('button', { name: 'Execute' });
    await execute.dblclick();
    await expect(page.getByText('Daily needs')).toBeVisible();
    expect(calls).toBe(1);
    expect(body).toEqual({
      scenarioId: 'DEMO-PARTIAL',
      stockMode: 'live',
      forecastId: FORECAST_ID,
    });
    await expect(page.getByText('Result saved in the history.')).toBeVisible();
    await expect(
      page
        .getByText('Calculation only. Stored stock was not changed', {
          exact: false,
        })
        .first()
    ).toBeVisible();
  });

  test('forecast: "edit" saves the next version and keeps the previous one', async ({
    page,
  }) => {
    await mockCatalogue(page);
    let list = [forecast];
    const posted = [];
    await page.route(`${API}/forecasts`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        posted.push(body);
        const v2 = {
          ...body,
          id: 'de01f0000000000000000002',
          version: 2,
          isActive: true,
        };
        list = [v2, forecast];
        return route.fulfill({ status: 201, json: v2 });
      }
      return route.fulfill({ json: list });
    });

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('button', { name: 'New version' }).first().click();

    const form = page.locator('form', {
      has: page.getByText('New version of “Semana demo” (v2)'),
    });
    await expect(form.getByLabel('Name')).toHaveValue('Semana demo');
    await expect(form.getByLabel('Name')).toHaveAttribute('readonly', '');
    await expect(
      form.getByText('v1 is not changed', { exact: false })
    ).toBeVisible();
    await form.locator('.ai-entry').nth(1).getByLabel('Quantity').fill('40');
    await form.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('“Semana demo” v2 was saved.')).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0].name).toBe('Semana demo');
    expect(posted[0]).not.toHaveProperty('version');
    expect(posted[0].entries[1].quantity).toBe(40);
    // Both versions stay listed; the newest is marked.
    const table = page.locator('table.ai-table').first();
    await expect(table.getByRole('cell', { name: /^v2/ })).toContainText(
      'Latest'
    );
    await expect(
      table.getByRole('cell', { name: 'v1', exact: true })
    ).toBeVisible();
  });

  test('forecast: deactivation asks for confirmation and removes it from the list', async ({
    page,
  }) => {
    await mockCatalogue(page);
    let list = [forecast];
    const updates = [];
    await page.route(`${API}/forecasts`, (route) =>
      route.fulfill({ json: list })
    );
    await page.route(`${API}/forecasts/${FORECAST_ID}`, async (route) => {
      updates.push({
        method: route.request().method(),
        body: route.request().postDataJSON(),
      });
      list = [];
      return route.fulfill({ json: { ...forecast, isActive: false } });
    });

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('button', { name: 'Deactivate' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Deactivate “Semana demo” v1?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(updates).toHaveLength(0);

    await page.getByRole('button', { name: 'Deactivate' }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await expect(page.getByText('There are no forecasts yet.')).toBeVisible();
    expect(updates).toEqual([{ method: 'PUT', body: { isActive: false } }]);
  });

  test('suppliers: the product export is downloaded as JSON', async ({
    page,
  }) => {
    await mockCatalogue(page);
    await page.route(`${API}/supplier-scenarios`, (route) =>
      route.fulfill({ json: [] })
    );

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('tab', { name: 'Suppliers' }).click();
    await expect(
      page.getByText('2 products available for offers.')
    ).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export JSON' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^laprizza-products-\d{4}-\d{2}-\d{2}\.json$/
    );
    const content = JSON.parse(
      await (
        await download.createReadStream()
      )
        .toArray()
        .then((c) => Buffer.concat(c).toString())
    );
    expect(content.products.map((p) => p.id)).toEqual([MOZZ, WATER]);
  });

  for (const { label, status, json, headers, expected } of [
    {
      label: '503 (service unavailable, Retry-After)',
      status: 503,
      headers: { 'Retry-After': '30' },
      json: {
        error: { status: 503, code: 'AI_SERVICE_UNAVAILABLE', message: 'x' },
      },
      expected: ['The planning service is unavailable.', 'Try again in 30 s.'],
    },
    {
      label: '504 (timeout)',
      status: 504,
      json: {
        error: { status: 504, code: 'AI_SERVICE_TIMEOUT', message: 'x' },
      },
      expected: ['The planning service is unavailable.'],
    },
    {
      label: '422 (missing information)',
      status: 422,
      json: {
        error: {
          status: 422,
          code: 'AI_INVALID_DATA',
          message: 'x',
          details: { problems: [{ code: 'MISSING_STOCK', productId: MOZZ }] },
        },
      },
      expected: ['information is missing', 'Stock entry missing'],
    },
  ]) {
    test(`execution: ${label} is explained and nothing is shown as a result`, async ({
      page,
    }) => {
      await page.route(`${API}/forecasts`, (route) =>
        route.fulfill({ json: [forecast] })
      );
      await page.route(`${API}/supplier-scenarios`, (route) =>
        route.fulfill({ json: [] })
      );
      await page.route(`${API}/planning/requirements`, (route) =>
        route.fulfill({ status, json, headers })
      );

      await login(page, managerSession);
      await openAiPage(page);
      await page.getByRole('tab', { name: 'Execution' }).click();
      await page.getByLabel('Requirements planning').check();
      await page.getByLabel('Scenario code').fill('DEMO-PARTIAL');
      await page.getByRole('button', { name: 'Execute' }).click();

      for (const text of expected) {
        await expect(
          page.getByText(text, { exact: false }).first()
        ).toBeVisible();
      }
      await expect(page.getByText('Daily needs')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Execute' })).toBeEnabled();
    });
  }

  test('results: each run shows the versions it used and its full plan', async ({
    page,
  }) => {
    const summary = {
      id: 'run-1',
      kind: 'requirements',
      createdAt: '2026-11-19T10:00:00Z',
      request: {
        scenarioId: 'DEMO-PARTIAL',
        stockMode: 'live',
        forecastId: FORECAST_ID,
      },
      snapshotId: 'snap-abc',
      forecast: { id: FORECAST_ID, name: 'Semana demo', version: 1 },
      supplierScenario: { id: 's1', name: 'Fornecedores demo', version: 2 },
      bomVersion: 'bom-123',
      stockSource: { source: 'backend-live' },
      status: 'ok',
      summary: { totalCostEur: 25, productsToBuy: 1, feasible: false },
      feasible: false,
    };
    const result = {
      status: 'ok',
      simulation: true,
      calculatedAt: '2026-11-19T10:00:00Z',
      scenario: {
        id: 'DEMO-PARTIAL',
        name: 'Demo',
        version: 1,
        stockMode: 'live',
      },
      inputs: { snapshotId: 'snap-abc' },
      plan: {
        forecastId: FORECAST_ID,
        forecastName: 'Semana demo',
        version: 1,
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        referenceDate: '2026-11-19',
      },
      summary: summary.summary,
      requirements: [
        {
          productId: MOZZ,
          name: 'Mozzarella',
          kind: 'simple',
          stockControlled: true,
          required: 30,
          available: 5,
          shortage: 25,
          needs: [
            { date: '2026-12-01', quantity: 10 },
            { date: '2026-12-02', quantity: 15 },
          ],
        },
      ],
      production: [],
      purchases: [
        {
          productId: MOZZ,
          name: 'Mozzarella',
          shortage: 25,
          covered: 10,
          uncovered: 15,
          costEur: 25,
          status: 'partial',
          allocations: [
            {
              supplierId: 'SUP-A',
              supplierName: 'Fornecedor A',
              forDate: '2026-12-01',
              quantity: 10,
              unitPriceEur: 2.5,
              costEur: 25,
              arrivalDate: '2026-11-21',
              onTime: true,
            },
          ],
          unmet: [
            { date: '2026-12-02', quantity: 15, reason: 'INSUFFICIENT_SUPPLY' },
          ],
        },
      ],
      warnings: [],
    };
    const listQueries = [];
    await page.route(`${API}/forecasts`, (route) =>
      route.fulfill({ json: [forecast] })
    );
    await page.route(`${API}/planning/runs?*`, (route) => {
      listQueries.push(new URL(route.request().url()).searchParams.toString());
      return route.fulfill({ json: [summary] });
    });
    await page.route(`${API}/planning/runs/run-1`, (route) =>
      route.fulfill({ json: { ...summary, result } })
    );

    await login(page, managerSession);
    await openAiPage(page);
    await page.getByRole('tab', { name: 'Results' }).click();

    const row = page.getByRole('row', { name: /Semana demo/ });
    await expect(row).toContainText('Fornecedores demo v2');
    await expect(row).toContainText('snap-abc');
    await expect(row).toContainText('bom-123');
    await expect(row).toContainText('Current stock');
    await expect(row).toContainText('Not feasible');

    await page
      .getByLabel('Forecast')
      .selectOption({ label: 'Semana demo · v1' });
    await expect
      .poll(() => listQueries.at(-1))
      .toContain(`forecastId=${FORECAST_ID}`);

    await row.getByRole('button', { name: 'View' }).click();
    const detail = page.getByRole('region', { name: /Result of/ });
    await expect(
      detail.getByRole('heading', { name: 'Daily needs' })
    ).toBeVisible();
    await expect(
      detail.getByRole('row', { name: /2026-12-02 Mozzarella 15/ })
    ).toBeVisible();
    await expect(detail.getByText('Fornecedor A')).toBeVisible();
    await expect(detail.getByText('2026-11-21')).toBeVisible();
    await expect(detail.getByText('Partially covered')).toBeVisible();
    await expect(detail.getByText('Insufficient supply')).toBeVisible();
    await expect(
      detail.getByText('Calculation only. Stored stock was not changed', {
        exact: false,
      })
    ).toBeVisible();
  });
});
