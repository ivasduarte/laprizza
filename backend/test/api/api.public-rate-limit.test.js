import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';

/**
 * Integration test (AA05): public routes are open to Guests but anonymous requests are limited per IP.
 * The limit applies to /catalogue; other routes and requests with a token are not affected.
 */
test('anonymous requests to public routes are rate limited; requests with a token are not', async (t) => {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test',
    RATE_LIMIT_ENABLED: 'true',
    PUBLIC_RATE_LIMIT_MAX: '2',
  });
  const productsRepository = { listProducts: async () => [] };
  const server = createApp(config, { productsRepository }).listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const api = `http://127.0.0.1:${server.address().port}/api/v1`;

  assert.equal((await fetch(`${api}/catalogue`)).status, 200);
  assert.equal((await fetch(`${api}/catalogue`)).status, 200);

  const blocked = await fetch(`${api}/catalogue`);
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);

  // With a token the limit is skipped; an invalid token is still a 401, never a 429 or Guest access
  const withToken = await fetch(`${api}/catalogue`, {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  assert.equal(withToken.status, 401);

  // Routes outside the public ones are not affected (allergens are MANAGER only, not public)
  assert.equal((await fetch(`${api}/products`)).status, 401);
  assert.equal((await fetch(`${api}/allergens`)).status, 401);
});

/**
 * Integration test (AA05): /auth/me and /auth/guest-permissions are registered before the /auth
 * rate limiter (the SPA calls them often); the other /auth routes stay limited.
 */
test('GET /auth/me and /auth/guest-permissions are outside the /auth rate limiter', async (t) => {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test',
    RATE_LIMIT_ENABLED: 'true',
    AUTH_RATE_LIMIT_MAX: '1',
  });
  const server = createApp(config, { productsRepository: { listProducts: async () => [] } }).listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const api = `http://127.0.0.1:${server.address().port}/api/v1`;

  const withToken = { headers: { Authorization: 'Bearer not-a-jwt' } };
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await fetch(`${api}/auth/me`, withToken)).status, 401); // never 429
    assert.equal((await fetch(`${api}/auth/guest-permissions`)).status, 200);
  }

  // The limiter still protects login (1 request per window in this test)
  const emptyLogin = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  };
  assert.equal((await fetch(`${api}/auth/login`, emptyLogin)).status, 400);
  assert.equal((await fetch(`${api}/auth/login`, emptyLogin)).status, 429);
});
