import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticate, verifyToken, requireRole } from '../../src/api/middleware/auth.middleware.js';
import { AuthErrorCode, authError } from '../../src/application/auth/auth-errors.js';
import {
  createAuthTestContext,
  createFakeSecurityLogger,
} from '../infrastructure/auth.dummy.dependencies.js';

const AUTHENTICATED = { userId: 'u1', role: 'MANAGER', roles: ['MANAGER'], sessionId: 's1' };

/** Fake authService: 'good' is valid, 'expired' has expired, anything else is invalid. */
const fakeAuthService = {
  async authenticateAccessToken(token) {
    if (token === 'good') return AUTHENTICATED;
    if (token === 'expired') throw authError(AuthErrorCode.TOKEN_EXPIRED, 401);
    throw authError(AuthErrorCode.TOKEN_INVALID, 401);
  },
};

/**
 * Creates a dummy Express 'next' function that records the argument it receives.
 * Without testing libraries (the project does not use Mockito/Sinon).
 */
function createDummyNext() {
  const calls = [];
  return { next: (err) => calls.push(err), calls, error: () => calls.at(-1) };
}

/** Minimal request. */
function createRequest(authorization, extra = {}) {
  return {
    headers: authorization ? { authorization } : {},
    ip: '127.0.0.1',
    method: 'GET',
    baseUrl: '/api/v1/users',
    path: '/',
    ...extra,
  };
}

/**
 * Unit test: missing header or a scheme other than Bearer -> 401 TOKEN_MISSING, logged (AA05).
 */
test('authenticate rejects missing or non-Bearer Authorization headers', async () => {
  const logger = createFakeSecurityLogger();
  const authenticate = createAuthenticate({ authService: fakeAuthService, securityLogger: logger });

  for (const header of [undefined, 'Basic dXNlcjpwYXNz']) {
    const { next, error } = createDummyNext();
    await authenticate(createRequest(header), {}, next);
    assert.equal(error().status, 401);
    assert.equal(error().code, AuthErrorCode.TOKEN_MISSING);
  }
  assert.equal(logger.events.length, 2);
  assert.equal(logger.events[0].event, 'ACCESS_DENIED');
  assert.equal(logger.events[0].path, '/api/v1/users/');
});

/**
 * Unit test: valid token -> req.user populated and next() with no error.
 */
test('authenticate populates req.user for a valid token', async () => {
  const authenticate = createAuthenticate({
    authService: fakeAuthService,
    securityLogger: createFakeSecurityLogger(),
  });
  const req = createRequest('Bearer good');
  const { next, calls } = createDummyNext();

  await authenticate(req, {}, next);

  assert.deepEqual(calls, [undefined]);
  assert.deepEqual(req.user, AUTHENTICATED);
});

/**
 * Unit test: the error code from the service propagates (e.g. TOKEN_EXPIRED for the SPA to refresh)
 * and is logged without the token.
 */
test('authenticate forwards the service error and logs it without the token', async () => {
  const logger = createFakeSecurityLogger();
  const authenticate = createAuthenticate({ authService: fakeAuthService, securityLogger: logger });
  const { next, error } = createDummyNext();

  await authenticate(createRequest('Bearer expired'), {}, next);

  assert.equal(error().code, AuthErrorCode.TOKEN_EXPIRED);
  assert.equal(logger.events[0].reason, AuthErrorCode.TOKEN_EXPIRED);
  assert.ok(!JSON.stringify(logger.events).includes('Bearer'));
  assert.ok(!('token' in logger.events[0]));
});

/**
 * Unit test: integration with the real service — a login token authenticates and the role comes from the database.
 */
test('authenticate works with the real auth service', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser({ role: 'MANAGER' });
  const { accessToken } = await ctx.service.login({ email: user.email, password: user.password });
  const authenticate = createAuthenticate({ authService: ctx.service, securityLogger: ctx.securityLogger });
  const req = createRequest(`Bearer ${accessToken}`);
  const { next, calls } = createDummyNext();

  await authenticate(req, {}, next);

  assert.deepEqual(calls, [undefined]);
  assert.equal(req.user.role, 'MANAGER');
  assert.equal(req.user.userId, String(user.id));
});

/**
 * Unit test: verifyToken delegates to the middleware configured in app.locals.
 */
test('verifyToken delegates to app.locals.authenticate', async () => {
  const authenticate = createAuthenticate({
    authService: fakeAuthService,
    securityLogger: createFakeSecurityLogger(),
  });
  const req = createRequest('Bearer good', { app: { locals: { authenticate } } });
  const { next, calls } = createDummyNext();

  await verifyToken(req, {}, next);

  assert.deepEqual(calls, [undefined]);
  assert.deepEqual(req.user, AUTHENTICATED);
});

/**
 * Unit test: without configuration it fails closed (500 error, never lets the request through).
 */
test('verifyToken fails closed when the middleware is not configured', () => {
  const { next, error } = createDummyNext();
  verifyToken(createRequest('Bearer good'), {}, next);
  assert.ok(error() instanceof Error);
  assert.equal(error().status, undefined); // -> 500 in the errorHandler
});

/**
 * Unit test: requireRole lets authorized roles through.
 */
test('requireRole allows authorized roles', () => {
  const { next, calls } = createDummyNext();
  requireRole(['MANAGER', 'EMPLOYEE'])({ user: { role: 'MANAGER' } }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

/**
 * Unit test (AA05): no permission -> 403 FORBIDDEN (distinct from 401) and logged.
 */
test('requireRole blocks unauthorized roles with 403 and logs it', () => {
  const logger = createFakeSecurityLogger();
  const req = {
    user: { userId: 'u9', role: 'CUSTOMER' },
    ip: '127.0.0.1',
    method: 'GET',
    baseUrl: '/api/v1/users',
    path: '/',
    app: { locals: { securityLogger: logger } },
  };
  const { next, error } = createDummyNext();

  requireRole(['MANAGER', 'EMPLOYEE'])(req, {}, next);

  assert.equal(error().status, 403);
  assert.equal(error().code, AuthErrorCode.FORBIDDEN);
  assert.equal(logger.events[0].reason, 'INSUFFICIENT_ROLE');
  assert.equal(logger.events[0].userId, 'u9');
});

/**
 * Unit test: without req.user (middleware order error) it is also 403.
 */
test('requireRole blocks requests without an authenticated user', () => {
  const { next, error } = createDummyNext();
  requireRole(['MANAGER'])({}, {}, next);
  assert.equal(error().status, 403);
});
