import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against their own Vite server, on a dedicated port, so they never depend on
 * the developer's `npm run dev` (its .env, API version or proxy target).
 * Every API call is simulated by the tests (page.route), so the proxy points to a closed local
 * port: a request a test forgot to mock fails at once instead of reaching a real back end.
 */
const PORT = 4300;
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: ORIGIN },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_API_BASE_URL: '/api/v2',
      VITE_ORIGIN: ORIGIN,
      API_PROXY_TARGET: 'http://127.0.0.1:9',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
