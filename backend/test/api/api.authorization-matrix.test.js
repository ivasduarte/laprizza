import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { API_PREFIX } from '../../src/api/api-versions.js';
import {
  PERSONAS,
  TEST_JWT_SECRET,
  createAuthMocks,
  createRepositoryStub,
  tokenFor,
} from '../support/auth-fixtures.js';
import { AUTHORIZATION_MATRIX, isAllowed, samplePath } from '../support/authorization-matrix.js';

/**
 * AA05 automated checks: every protected route x every persona (Guest, Customer, Employee,
 * Manager, Manager+Employee, Customer+Employee, user without roles).
 * - allowed  -> the request gets past authorization (never 401/403; 200/400/404 are business outcomes);
 * - denied   -> 401 TOKEN_MISSING for Guests, 403 FORBIDDEN for authenticated users, and the
 *               attempt is recorded in the security log without credentials.
 * Repositories are stubs: no database, and refused requests never reach them.
 */
async function startServer() {
  const stub = () => createRepositoryStub();
  const authMocks = createAuthMocks();
  const repos = {
    ...authMocks,
    productsRepository: stub(),
    productCategoriesRepository: stub(),
    allergenRepository: stub(),
    pizzaComponentTypesRepository: stub(),
    stockRepository: stub(),
    predefinedPizzaRepository: stub(),
    sizeRepository: stub(),
    customersRepository: stub(),
    postalCodeValidator: { isValidMatch: async () => true },
    aiDataRepository: stub(),
    kitchenConfigurationRepository: stub(),
    assemblyLineConfigurationRepository: stub(),
    forecastRepository: stub(),
    supplierScenarioRepository: stub(),
    planningRunRepository: stub(),
    sharedResourcesStorage: stub(),
    databaseHealthProbe: stub(),
    versionInfo: {},
  };
  const app = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: TEST_JWT_SECRET }), repos);
  const server = app.listen(0);
  await once(server, 'listening');
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}${API_PREFIX}`,
    logger: authMocks.securityLogger,
  };
}

const WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

function send(baseUrl, method, path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (WITH_BODY.has(method)) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: WITH_BODY.has(method) ? '{}' : undefined,
  });
}

test('authorization matrix: every route x every persona', async (t) => {
  const { server, baseUrl, logger } = await startServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  for (const [method, pattern, access] of AUTHORIZATION_MATRIX) {
    const path = samplePath(pattern);

    await t.test(`${method} ${pattern}`, async () => {
      for (const [personaName, persona] of Object.entries(PERSONAS)) {
        const label = `${method} ${pattern} as ${personaName}`;
        const token = tokenFor(personaName);
        const logsBefore = logger.log.mock.callCount();

        const res = await send(baseUrl, method, path, token);
        const body = await res.json().catch(() => null);

        if (isAllowed(access, persona?.roles ?? null)) {
          assert.ok(
            ![401, 403].includes(res.status),
            `${label}: expected access, got ${res.status}`,
          );
          continue;
        }

        const expected = persona
          ? { status: 403, code: 'FORBIDDEN' }
          : { status: 401, code: 'TOKEN_MISSING' };
        assert.equal(res.status, expected.status, label);
        assert.equal(body?.error?.code, expected.code, label);
        assert.deepEqual(Object.keys(body), ['error'], `${label}: a refusal reveals no data`);

        const denials = logger.log.mock.calls
          .slice(logsBefore)
          .filter((call) => call.arguments[0] === 'ACCESS_DENIED');
        assert.equal(denials.length, 1, `${label}: the attempt is recorded once`);
        const details = denials[0].arguments[1];
        assert.equal(details.method, method, label);
        // Root routes of a router are logged with a trailing slash (e.g. ${API_PREFIX}/products/)
        assert.equal(details.path.replace(/(.)\/$/, '$1'), `${API_PREFIX}${path}`, label);
        assert.equal(details.userId, persona?._id, label);
        if (token)
          assert.ok(!JSON.stringify(details).includes(token), `${label}: no token in the log`);
      }
    });
  }
});
