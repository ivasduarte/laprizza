import { test, expect } from './support/test.js';
import { SESSIONS } from './support/sessions.js';

// Dados simulados para os testes
// Login responses with roles and permissions, as the back end returns them (AA05/WEB03).
const mockManagerSession = SESSIONS.MANAGER;

const mockEmployeeSession = SESSIONS.EMPLOYEE;

const LINE_ID = '6650f1c2a9b3e4d5f6a7b8c9';

const mockLine = {
  id: LINE_ID,
  name: 'Linha VIS03',
  content: {
    dimensions: { width: 9, length: 1.4, height: 2.6 },
    elements: [
      {
        id: 'conveyor-01',
        type: 'conveyor-belt',
        position: { x: 0, y: 0.9, z: 0.7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 6.4, y: 1, z: 1 },
      },
      {
        id: 'arm-01',
        type: 'robotic-arm',
        position: { x: 0, y: 0.9, z: 0.15 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
  },
};

const kitchenWithoutLine = {
  id: '1',
  name: 'Standard Layout',
  isActive: true,
  content: { dimensions: { width: 10, length: 15, height: 3 }, elements: [] },
};

const kitchenWithLine = {
  ...kitchenWithoutLine,
  name: 'Cozinha VIS03',
  content: {
    ...kitchenWithoutLine.content,
    assemblyLine: {
      configurationId: LINE_ID,
      position: { x: -5, y: 0, z: 0 },
      rotation: { x: 0, y: 90, z: 0 },
    },
  },
};

/** Mocks login, the kitchen endpoints and the assembly line list. */
async function mockApi(page, { session, activeKitchen, lines }) {
  await page.route('**/api/v2/auth/login', (route) =>
    route.fulfill({ json: session })
  );
  await page.route('**/api/v2/kitchen-configurations', (route) =>
    route.fulfill({ json: [activeKitchen] })
  );
  await page.route('**/api/v2/kitchen-configurations/active', (route) =>
    route.fulfill({ json: activeKitchen })
  );
  await page.route('**/api/v2/assembly-line-configurations', (route) =>
    route.fulfill({ json: lines })
  );
}

async function loginAndOpenKitchenConfigs(page, email) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'StrongPassword123!');
  await Promise.all([
    page.waitForResponse('**/api/v2/auth/login'),
    page.click('button[type="submit"]'),
  ]);
  await page.getByRole('link', { name: 'Kitchen Configuration' }).click();
}

/** The assembly line section; its buttons share names with the kitchen ones. */
const linesSection = (page) =>
  page.getByRole('region', { name: 'Assembly lines' });

test.describe('Assembly Line Configuration E2E (VIS03)', () => {
  test('RBAC: an Employee never loads the assembly lines (kitchen is MANAGER only)', async ({
    page,
  }) => {
    let lineRequests = 0;
    await mockApi(page, {
      session: mockEmployeeSession,
      activeKitchen: kitchenWithoutLine,
      lines: [mockLine],
    });
    await page.route('**/api/v2/assembly-line-configurations**', (route) => {
      lineRequests += 1;
      return route.fulfill({ json: [mockLine] });
    });

    await page.goto('/login');
    await page.fill('input[type="email"]', 'emp@laprizza.pt');
    await page.fill('input[type="password"]', 'StrongPassword123!');
    await Promise.all([
      page.waitForResponse('**/api/v2/auth/login'),
      page.click('button[type="submit"]'),
    ]);
    await page.evaluate(() => {
      window.history.pushState({}, '', '/kitchen-configurations');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /access denied/i
    );
    await expect(linesSection(page)).toHaveCount(0);
    expect(lineRequests).toBe(0);
  });

  test('Manager Flow: creates a line from the VIS03 default content', async ({
    page,
  }) => {
    let lines = [];
    let createdBody = null;

    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithoutLine,
      lines,
    });
    // Registered last, so it takes precedence: serves the list and the creation.
    await page.route(
      '**/api/v2/assembly-line-configurations',
      async (route) => {
        if (route.request().method() === 'POST') {
          createdBody = route.request().postDataJSON();
          const created = { id: LINE_ID, ...createdBody };
          lines = [created];
          await route.fulfill({ status: 201, json: created });
          return;
        }
        await route.fulfill({ json: lines });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    const section = linesSection(page);
    await section.getByRole('button', { name: 'New assembly line' }).click();

    // The form opens with the VIS03 arrangement as default content.
    const editor = page.locator('textarea#assembly-line-content');
    await expect(editor).toHaveValue(/"crust-dispenser"/);
    await expect(editor).toHaveValue(/"wood-fired-oven"/);

    await page.fill('input#assembly-line-name', 'Linha VIS03');
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    // The list is reloaded with the new line and the form closes.
    await expect(
      section.getByRole('heading', { name: 'Linha VIS03' })
    ).toBeVisible();
    await expect(editor).toHaveCount(0);

    expect(createdBody.name).toBe('Linha VIS03');
    const types = createdBody.content.elements.map((element) => element.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'counter',
        'receiving-platform',
        'crust-dispenser',
        'conveyor-belt',
        'robotic-arm',
        'wood-fired-oven',
      ])
    );
  });

  test('Manager Flow: a line referenced by a kitchen cannot be deleted (409)', async ({
    page,
  }) => {
    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithLine,
      lines: [mockLine],
    });
    await page.route(
      `**/api/v2/assembly-line-configurations/${LINE_ID}`,
      async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 409,
            json: {
              error: {
                message:
                  'Cannot delete an assembly line configuration referenced by 1 kitchen configuration(s).',
              },
            },
          });
          return;
        }
        await route.fulfill({ json: mockLine });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    const section = linesSection(page);
    await section.getByRole('button', { name: 'Delete' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(section.locator('p[role="alert"]')).toContainText(
      'used by one or more kitchen configurations'
    );
    // The line is still listed.
    await expect(
      section.getByRole('heading', { name: 'Linha VIS03' })
    ).toBeVisible();
  });

  test('Manager Flow: choosing a line in the kitchen form writes the placement into the JSON', async ({
    page,
  }) => {
    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithoutLine,
      lines: [mockLine],
    });

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    await page.getByRole('button', { name: 'Create New' }).click();
    await page
      .locator('select#kitchen-assembly-line')
      .selectOption({ label: 'Linha VIS03' });

    const editor = page.locator('textarea#config-content');
    await expect(editor).toHaveValue(/"assemblyLine"/);
    await expect(editor).toHaveValue(
      new RegExp(`"configurationId": "${LINE_ID}"`)
    );

    // Choosing "no line" removes the placement again.
    await page
      .locator('select#kitchen-assembly-line')
      .selectOption({ index: 0 });
    await expect(editor).not.toHaveValue(/"assemblyLine"/);
  });

  test('Viewer: shows the assembly line referenced by the active kitchen', async ({
    page,
  }) => {
    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithLine,
      lines: [mockLine],
    });
    await page.route(
      `**/api/v2/assembly-line-configurations/${LINE_ID}`,
      (route) => route.fulfill({ json: mockLine })
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    await expect(page.getByTestId('viewer-active-config')).toContainText(
      'Cozinha VIS03'
    );
    await expect(page.getByTestId('viewer-assembly-line')).toContainText(
      'Linha VIS03'
    );
  });

  test('Viewer: a broken line reference is reported, never replaced by another line', async ({
    page,
  }) => {
    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithLine,
      lines: [],
    });
    await page.route(
      `**/api/v2/assembly-line-configurations/${LINE_ID}`,
      (route) =>
        route.fulfill({
          status: 404,
          json: {
            error: { message: 'Assembly Line configuration not found.' },
          },
        })
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    // The kitchen is still shown, with a visible warning and no line.
    await expect(page.getByTestId('viewer-active-config')).toContainText(
      'Cozinha VIS03'
    );
    await expect(
      page.getByText("This kitchen's assembly line could not be loaded")
    ).toBeVisible();
    await expect(page.getByTestId('viewer-assembly-line')).toHaveCount(0);
  });

  // --- VIS04: textures and materials from the back end ---

  const texturedLine = {
    ...mockLine,
    content: {
      ...mockLine.content,
      elements: mockLine.content.elements.map((element) => ({
        ...element,
        material: {
          colorMap: `/textures/${element.id}/diffuse.jpg`,
          normalMap: `/textures/${element.id}/normal.jpg`,
          roughnessMap: `/textures/${element.id}/rough.jpg`,
        },
      })),
    },
  };

  // 1x1 PNG, enough for the texture loader.
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  test('Viewer: loads the textures referenced by the JSON material of each element', async ({
    page,
  }) => {
    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithLine,
      lines: [texturedLine],
    });
    await page.route(
      `**/api/v2/assembly-line-configurations/${LINE_ID}`,
      (route) => route.fulfill({ json: texturedLine })
    );
    const requested = new Set();
    await page.route('**/textures/**', (route) => {
      requested.add(new URL(route.request().url()).pathname);
      return route.fulfill({ body: PIXEL, contentType: 'image/png' });
    });

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');
    await expect(page.getByTestId('viewer-assembly-line')).toContainText(
      'Linha VIS03'
    );

    const expected = texturedLine.content.elements.flatMap((element) => [
      `/textures/${element.id}/diffuse.jpg`,
      `/textures/${element.id}/normal.jpg`,
      `/textures/${element.id}/rough.jpg`,
    ]);
    await expect
      .poll(() => expected.filter((path) => !requested.has(path)))
      .toEqual([]);
  });

  test('Viewer: a missing texture does not break the scene', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await mockApi(page, {
      session: mockManagerSession,
      activeKitchen: kitchenWithLine,
      lines: [texturedLine],
    });
    await page.route(
      `**/api/v2/assembly-line-configurations/${LINE_ID}`,
      (route) => route.fulfill({ json: texturedLine })
    );
    await page.route('**/textures/**', (route) =>
      route.fulfill({ status: 404, body: '' })
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    // The kitchen, the line and the canvas stay on screen (plain materials are used).
    await expect(page.getByTestId('viewer-assembly-line')).toContainText(
      'Linha VIS03'
    );
    await expect(page.locator('canvas')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
