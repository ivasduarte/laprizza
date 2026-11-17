import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  requirePermission,
  requireAuthenticated,
} from '../../src/api/middleware/authorization.middleware.js';
import { AuthErrorCode, authError } from '../../src/application/auth/auth-errors.js';
import { permissionsFor } from '../../src/domain/auth/permissions.domain.js';

const TOKENS = {
  employee: { userId: 'u-emp', roles: ['EMPLOYEE'], permissions: permissionsFor(['EMPLOYEE']), sessionId: 's1' },
  noRoles: { userId: 'u-none', roles: [], permissions: permissionsFor([]), sessionId: 's2' },
};

/** Mocked app.locals.authenticate: 'Bearer <name>' authenticates TOKENS[name]; anything else is invalid. */
function createRequest(authorization) {
  const securityLogger = { log: mock.fn() };
  const authenticate = mock.fn(async (req, _res, next) => {
    const user = TOKENS[req.headers.authorization?.replace('Bearer ', '')];
    if (!user) return next(authError(AuthErrorCode.TOKEN_INVALID, 401));
    req.user = user;
    next();
  });
  const req = {
    headers: authorization ? { authorization } : {},
    ip: '127.0.0.1',
    method: 'GET',
    baseUrl: '/api/v1/stock',
    path: '/',
    app: { locals: { authenticate, securityLogger } },
  };
  return { req, authenticate, securityLogger };
}

/** Runs a middleware and resolves with the value passed to next(). */
const run = (middleware, req) =>
  new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });

const logged = (securityLogger) => securityLogger.log.mock.calls.map((c) => c.arguments);

test('Guest (no Authorization header) gets the public permissions without authenticating', async () => {
  const { req, authenticate } = createRequest();
  assert.equal(await run(requirePermission('catalogue:read'), req), undefined);
  assert.equal(req.principal.guest, true);
  assert.deepEqual([...req.principal.permissions], ['catalogue:read']);
  assert.equal(req.user, undefined);
  assert.equal(authenticate.mock.callCount(), 0);
});

test('Guest without the permission -> 401 TOKEN_MISSING, logged with the required permission', async () => {
  const { req, securityLogger } = createRequest();
  const err = await run(requirePermission('stock:read'), req);
  assert.equal(err.status, 401);
  assert.equal(err.code, AuthErrorCode.TOKEN_MISSING);
  const [[event, details]] = logged(securityLogger);
  assert.equal(event, 'ACCESS_DENIED');
  assert.equal(details.required, 'stock:read');
  assert.equal(details.reason, AuthErrorCode.TOKEN_MISSING);
});

test('an invalid token is a 401, never a Guest', async () => {
  const { req } = createRequest('Bearer forged');
  const err = await run(requirePermission('catalogue:read'), req);
  assert.equal(err.status, 401);
  assert.equal(err.code, AuthErrorCode.TOKEN_INVALID);
  assert.equal(req.principal, undefined);
});

test('an authenticated user with the permission passes', async () => {
  const { req } = createRequest('Bearer employee');
  assert.equal(await run(requirePermission('stock:read'), req), undefined);
  assert.equal(req.principal.guest, false);
  assert.equal(req.principal.userId, 'u-emp');
  assert.equal(req.user.userId, 'u-emp');
});

test('an authenticated user without the permission -> 403 FORBIDDEN, logged without secrets', async () => {
  const { req, securityLogger } = createRequest('Bearer employee');
  const err = await run(requirePermission('stock:write'), req);
  assert.equal(err.status, 403);
  assert.equal(err.code, AuthErrorCode.FORBIDDEN);

  const [[event, details]] = logged(securityLogger);
  assert.equal(event, 'ACCESS_DENIED');
  assert.equal(details.userId, 'u-emp');
  assert.deepEqual(details.roles, ['EMPLOYEE']);
  assert.equal(details.required, 'stock:write');
  assert.equal(details.reason, 'MISSING_PERMISSION');
  assert.equal(details.path, '/api/v1/stock/');
  assert.equal(JSON.stringify(details).includes('Bearer'), false);
});

test('a user without roles is authenticated: public routes pass, protected routes are 403 (not 401)', async () => {
  const pub = createRequest('Bearer noRoles');
  assert.equal(await run(requirePermission('catalogue:read'), pub.req), undefined);

  const prot = createRequest('Bearer noRoles');
  assert.equal((await run(requirePermission('stock:read'), prot.req)).status, 403);
});

test('the principal is resolved once per request', async () => {
  const { req, authenticate } = createRequest('Bearer employee');
  await run(requirePermission('products:read'), req);
  await run(requirePermission('stock:read'), req);
  assert.equal(authenticate.mock.callCount(), 1);
});

test('requirePermission exposes the permission for the route-coverage test', () => {
  assert.equal(requirePermission('stock:write').permission, 'stock:write');
  assert.equal(requireAuthenticated.authenticatedOnly, true);
});

test('requireAuthenticated: 401 for Guest, passes for any authenticated user', async () => {
  const guest = createRequest();
  const err = await run(requireAuthenticated, guest.req);
  assert.equal(err.status, 401);
  assert.equal(err.code, AuthErrorCode.TOKEN_MISSING);

  const user = createRequest('Bearer noRoles');
  assert.equal(await run(requireAuthenticated, user.req), undefined);
});

test('fails closed when the authentication middleware is not configured', async () => {
  const { req } = createRequest('Bearer employee');
  req.app.locals.authenticate = undefined;
  const err = await run(requirePermission('catalogue:read'), req);
  assert.ok(err instanceof Error);
  assert.equal(err.status, undefined); // -> 500 in the errorHandler
});
