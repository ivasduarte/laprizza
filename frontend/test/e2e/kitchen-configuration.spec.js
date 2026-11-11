import { test, expect } from '@playwright/test';

// Dados simulados para os testes
const mockManagerSession = {
  accessToken: 'fake-jwt-token',
  user: { id: '1', email: 'admin@laprizza.pt', roles: ['MANAGER'] },
};

const mockEmployeeSession = {
  accessToken: 'fake-jwt-token',
  user: { id: '2', email: 'emp@laprizza.pt', roles: ['EMPLOYEE'] },
};

const mockConfigs = [
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

async function loginAndOpenKitchenConfigs(page, email) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'StrongPassword123!');
  await Promise.all([
    page.waitForResponse('**/api/v1/auth/login'),
    page.click('button[type="submit"]'),
  ]);
  await page.getByRole('link', { name: 'Kitchen Configuration' }).click();
}

test.describe('Kitchen Configuration Page E2E', () => {
  test('RBAC: Employee gets a read-only view (no management controls)', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockEmployeeSession });
    });
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      await route.fulfill({ json: mockConfigs });
    });
    await page.route(
      '**/api/v1/kitchen-configurations/active',
      async (route) => {
        await route.fulfill({ json: mockConfigs[0] });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'emp@laprizza.pt');

    // Can consult the list, the JSON and the viewer...
    await expect(
      page.getByRole('heading', { name: 'Standard Layout' })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Automated Line' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'View' }).first()
    ).toBeVisible();
    await expect(page.getByTestId('viewer-active-config')).toContainText(
      'Standard Layout'
    );

    // ...but cannot create, edit, activate or delete.
    await expect(page.getByRole('button', { name: 'Create New' })).toHaveCount(
      0
    );
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activate' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });

  test('Viewer: shows an explicit empty state when no configuration is active (404)', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      await route.fulfill({
        json: mockConfigs.map((c) => ({ ...c, isActive: false })),
      });
    });
    await page.route(
      '**/api/v1/kitchen-configurations/active',
      async (route) => {
        await route.fulfill({
          status: 404,
          json: {
            error: { message: 'No active kitchen configuration found.' },
          },
        });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    await expect(
      page.getByText('No active kitchen configuration to display.')
    ).toBeVisible();
    await expect(page.getByTestId('viewer-active-config')).toHaveCount(0);
  });

  test('Manager Flow: Switches active configuration and reloads viewer', async ({
    page,
  }) => {
    // 1. Simular o login de um Manager
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });

    // Simular a listagem de configurações e a configuração ativa (muda após a ativação)
    let activeConfig = mockConfigs[0];
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      await route.fulfill({ json: mockConfigs });
    });
    await page.route(
      '**/api/v1/kitchen-configurations/active',
      async (route) => {
        await route.fulfill({ json: activeConfig });
      }
    );

    // Intercetar a chamada de ativação da configuração 2
    await page.route(
      '**/api/v1/kitchen-configurations/2/activate',
      async (route) => {
        // Quando ativamos a 2, a API devolveria a 2 ativa
        activeConfig = { ...mockConfigs[1], isActive: true };
        await route.fulfill({ json: { ...mockConfigs[1], isActive: true } });
      }
    );

    // Fazer login e navegar
    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    // Verificar se as duas configurações estão no ecrã
    await expect(
      page.getByRole('heading', { name: 'Standard Layout' })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Automated Line' })
    ).toBeVisible();

    // 3. Clicar em "Activate" na configuração inativa (Automated Line)
    // O botão Activate estará dentro do card que NÃO tem a classe 'active'
    const inactiveCard = page.locator('.kitchen-config-card:not(.active)');
    await inactiveCard.getByRole('button', { name: 'Activate' }).click();

    // WEB04: confirmation dialog of the app (no longer window.confirm)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Activate' })
      .click();

    // 4. Verificar a mensagem de sucesso e o reload do viewer
    await expect(
      page.locator('p[role="status"]').filter({ hasText: 'successfully' })
    ).toBeVisible();
    // O viewer é remontado (ADR-0027) e volta a pedir a configuração ativa
    await expect(page.getByTestId('viewer-active-config')).toContainText(
      'Automated Line'
    );
  });

  test('Manager Flow: Rejects an invalid JSON configuration edit', async ({
    page,
  }) => {
    // 1. Simular o login de um Manager
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      await route.fulfill({ json: mockConfigs });
    });
    await page.route(
      '**/api/v1/kitchen-configurations/active',
      async (route) => {
        await route.fulfill({ json: mockConfigs[0] });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    // 2. Abrir o formulário de uma nova configuração (ou editar)
    await page.getByRole('button', { name: 'Create New' }).click();

    // 3. Inserir nome e JSON inválido (Falta uma aspa no JSON)
    await page.fill('input#config-name', 'Invalid Config');
    await page.fill(
      'textarea#config-content',
      '{ "dimensions": { "width": 10, "length": 15, "height": 3 }, "elements": [ }'
    ); // Sintaxe inválida propositada

    // 4. Clicar em Guardar
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    // 5. Verificar se a mensagem de erro de Parse (do Frontend) aparece e o formulário não fecha
    await expect(page.locator('p[role="alert"]')).toContainText(
      'Invalid JSON format'
    );
    await expect(page.locator('textarea#config-content')).toBeVisible(); // O formulário continua aberto para o utilizador corrigir
  });

  test('Manager Flow: Rejects an invalid JSON file import', async ({
    page,
  }) => {
    // 1. Simular o login de um Manager
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({ json: mockManagerSession });
    });
    await page.route('**/api/v1/kitchen-configurations', async (route) => {
      await route.fulfill({ json: mockConfigs });
    });
    await page.route(
      '**/api/v1/kitchen-configurations/active',
      async (route) => {
        await route.fulfill({ json: mockConfigs[0] });
      }
    );

    await loginAndOpenKitchenConfigs(page, 'admin@laprizza.pt');

    // 2. Abrir o formulário de uma nova configuração
    await page.getByRole('button', { name: 'Create New' }).click();

    // 3. Criar um ficheiro JSON inválido em memória e simular o upload
    const invalidJsonContent = Buffer.from('isto nao é um json valido');
    await page.setInputFiles('input[type="file"]', {
      name: 'invalid-config.json',
      mimeType: 'application/json',
      buffer: invalidJsonContent,
    });

    // 4. Verificar se o frontend apanha o erro de parsing do FileReader
    await expect(page.locator('p[role="alert"]')).toContainText(
      'The selected file is not a valid JSON.'
    );
  });
});