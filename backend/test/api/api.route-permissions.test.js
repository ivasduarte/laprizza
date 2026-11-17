import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PERMISSIONS } from '../../src/domain/auth/permissions.domain.js';
import { listApiRoutes } from '../support/route-inventory.js';
import { AUTHORIZATION_MATRIX, PUBLIC_ENTRY_POINTS } from '../support/authorization-matrix.js';

/**
 * AA05 guard rails: a new route cannot be added without deciding who may use it.
 * Every route must be guarded (requirePermission / requireAuthenticated) or be a listed public
 * entry point, and every guarded route must have its row in the authorization matrix.
 */
const routes = listApiRoutes();
const key = (method, path) => `${method} ${path}`;
const matrixKeys = new Set(AUTHORIZATION_MATRIX.map(([method, path]) => key(method, path)));
const publicKeys = new Set(PUBLIC_ENTRY_POINTS.map(([method, path]) => key(method, path)));

test('the route inventory finds the API routes', () => {
  assert.ok(
    routes.length >= matrixKeys.size + publicKeys.size,
    `only ${routes.length} routes found`,
  );
});

test('every route is guarded or is a listed public entry point', () => {
  const unguarded = routes
    .filter((r) => !r.permission && !r.authenticatedOnly && !publicKeys.has(key(r.method, r.path)))
    .map((r) => key(r.method, r.path));
  assert.deepEqual(unguarded, [], 'routes without requirePermission/requireAuthenticated');
});

test('public entry points stay unguarded (they must work without a session)', () => {
  const guarded = routes
    .filter((r) => publicKeys.has(key(r.method, r.path)) && (r.permission || r.authenticatedOnly))
    .map((r) => key(r.method, r.path));
  assert.deepEqual(guarded, []);
});

test('every guarded route has a row in the authorization matrix', () => {
  const missing = routes
    .filter((r) => (r.permission || r.authenticatedOnly) && !matrixKeys.has(key(r.method, r.path)))
    .map((r) => key(r.method, r.path));
  assert.deepEqual(missing, [], 'add these routes to test/support/authorization-matrix.js');
});

test('the matrix and the public list only name routes that exist', () => {
  const existing = new Set(routes.map((r) => key(r.method, r.path)));
  const stale = [...matrixKeys, ...publicKeys].filter((k) => !existing.has(k));
  assert.deepEqual(stale, []);
});

test('every permission used by a route exists in the permission catalogue', () => {
  const unknown = routes
    .filter((r) => r.permission && !ALL_PERMISSIONS.includes(r.permission))
    .map((r) => `${key(r.method, r.path)} -> ${r.permission}`);
  assert.deepEqual(unknown, []);
});
