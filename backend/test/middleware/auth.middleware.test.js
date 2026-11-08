import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { createAuthenticate, verifyToken, requireRole } from '../../src/api/middleware/auth.middleware.js';
import { AuthErrorCode, authError } from '../../src/application/auth/auth-errors.js';
import { createAuthService } from '../../src/application/auth/auth.service.js';
import { createPasswordHasher } from '../../src/infrastructure/security/password-hasher.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

const AUTHENTICATED = { userId: 'u1', role: 'MANAGER', roles: ['MANAGER'], sessionId: 's1' };

/** Mocked authService: 'good' is valid, 'expired' has expired, anything else is invalid. */
function createAuthServiceMock() {
  return {
    authenticateAccessToken: mock.fn(async (token) => {
      if (token === 'good') return AUTHENTICATED;
      if (token === 'expired') throw authError(AuthErrorCode.TOKEN_EXPIRED, 401);
      throw authError(AuthErrorCode.TOKEN_INVALID, 401);
    }),
  };
}

/** Mocked security logger. */
const createSecurityLoggerMock = () => ({ log: mock.fn() });

/** Details of the logged security events ([event, details] per call). */
const loggedCalls = (logger) => logger.log.mock.calls.map((c) => c.arguments);

/** Argument received by the last call of the mocked Express 'next'. */
const lastError = (next) => next.mock.calls.at(-1).arguments[0];

/** Asserts that the mocked 'next' was called once and without an error. */
function assertNextWithoutError(next) {
  assert.equal(next.mock.callCount(), 1);
  assert.equal(lastError(next), undefined);
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
  const logger = createSecurityLoggerMock();
  const authService = createAuthServiceMock();
  const authenticate = createAuthenticate({ authService, securityLogger: logger });

  for (const header of [undefined, 'Basic dXNlcjpwYXNz']) {
    const next = mock.fn();
    await authenticate(createRequest(header), {}, next);
    assert.equal(lastError(next).status, 401);
    assert.equal(lastError(next).code, AuthErrorCode.TOKEN_MISSING);
  }
  assert.equal(authService.authenticateAccessToken.mock.callCount(), 0);
  assert.equal(logger.log.mock.callCount(), 2);
  const [event, details] = loggedCalls(logger)[0];
  assert.equal(event, 'ACCESS_DENIED');
  assert.equal(details.path, '/api/v1/users/');
});

/**
 * Unit test: valid token -> req.user populated and next() with no error.
 */
test('authenticate populates req.user for a valid token', async () => {
  const authService = createAuthServiceMock();
  const authenticate = createAuthenticate({
    authService,
    securityLogger: createSecurityLoggerMock(),
  });
  const req = createRequest('Bearer good');
  const next = mock.fn();

  await authenticate(req, {}, next);

  assertNextWithoutError(next);
  assert.deepEqual(req.user, AUTHENTICATED);
  assert.deepEqual(authService.authenticateAccessToken.mock.calls[0].arguments, ['good']);
});

/**
 * Unit test: the error code from the service propagates (e.g. TOKEN_EXPIRED for the SPA to refresh)
 * and is logged without the token.
 */
test('authenticate forwards the service error and logs it without the token', async () => {
  const logger = createSecurityLoggerMock();
  const authenticate = createAuthenticate({
    authService: createAuthServiceMock(),
    securityLogger: logger,
  });
  const next = mock.fn();

  await authenticate(createRequest('Bearer expired'), {}, next);

  assert.equal(lastError(next).code, AuthErrorCode.TOKEN_EXPIRED);
  const [, details] = loggedCalls(logger)[0];
  assert.equal(details.reason, AuthErrorCode.TOKEN_EXPIRED);
  assert.ok(!JSON.stringify(loggedCalls(logger)).includes('Bearer'));
  assert.ok(!('token' in details));
});

/**
 * Unit test: integration with the real service — a login token authenticates and the role comes from the database.
 */
test('authenticate works with the real auth service', async () => {
  const USER_ID = 'abcdef000000000000000001';
  const SESSION_ID = 'bbbbbb000000000000000001';
  const PASSWORD = 'StrongPassword123!';
  const now = new Date('2026-11-02T10:00:00.000Z');
  const passwordHasher = createPasswordHasher({
    type: argon2.argon2id,
    memoryCost: 1024,
    timeCost: 1,
    parallelism: 1,
  });
  const user = {
    _id: USER_ID,
    email: 'manager@laprizza.pt',
    role: 'MANAGER',
    status: 'active',
    passwordHash: await passwordHasher.hash(PASSWORD),
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
  };
  const usersRepository = {
    findByEmailWithPasswordHash: mock.fn(async () => user),
    findById: mock.fn(async () => user),
  };
  const sessionsRepository = {
    create: mock.fn(async (data) => ({ _id: SESSION_ID, ...data })),
    // Returns the session exactly as it was created at login.
    findById: mock.fn(async () => ({
      _id: SESSION_ID,
      ...sessionsRepository.create.mock.calls[0].arguments[0],
    })),
  };
  const securityLogger = createSecurityLoggerMock();
  const service = createAuthService({
    usersRepository,
    sessionsRepository,
    resetTokensRepository: {},
    loginThrottleRepository: {},
    passwordHasher,
    tokenService: createTokenService({ jwtSecret: 'test_secret_key', accessTokenTtlSeconds: 3600 }),
    emailService: {},
    securityLogger,
    clock: { now: mock.fn(() => new Date(now)) },
    config: {
      refreshTokenTtlMs: 7 * 86_400_000,
      lockoutThreshold: 3,
      lockoutStepsMs: [60_000, 300_000, 1_800_000],
    },
  });

  const { accessToken } = await service.login({ email: user.email, password: PASSWORD });
  const authenticate = createAuthenticate({ authService: service, securityLogger });
  const req = createRequest(`Bearer ${accessToken}`);
  const next = mock.fn();

  await authenticate(req, {}, next);

  assertNextWithoutError(next);
  assert.equal(req.user.role, 'MANAGER');
  assert.equal(req.user.userId, USER_ID);
  assert.equal(usersRepository.findById.mock.calls[0].arguments[0], USER_ID);
});

/**
 * Unit test: verifyToken delegates to the middleware configured in app.locals.
 */
test('verifyToken delegates to app.locals.authenticate', async () => {
  const authenticate = mock.fn(
    createAuthenticate({
      authService: createAuthServiceMock(),
      securityLogger: createSecurityLoggerMock(),
    }),
  );
  const req = createRequest('Bearer good', { app: { locals: { authenticate } } });
  const res = {};
  const next = mock.fn();

  await verifyToken(req, res, next);

  assert.equal(authenticate.mock.callCount(), 1);
  assert.deepEqual(authenticate.mock.calls[0].arguments, [req, res, next]);
  assertNextWithoutError(next);
  assert.deepEqual(req.user, AUTHENTICATED);
});

/**
 * Unit test: without configuration it fails closed (500 error, never lets the request through).
 */
test('verifyToken fails closed when the middleware is not configured', () => {
  const next = mock.fn();
  verifyToken(createRequest('Bearer good'), {}, next);
  assert.ok(lastError(next) instanceof Error);
  assert.equal(lastError(next).status, undefined); // -> 500 in the errorHandler
});

/**
 * Unit test: requireRole lets authorized roles through.
 */
test('requireRole allows authorized roles', () => {
  const next = mock.fn();
  requireRole(['MANAGER', 'EMPLOYEE'])({ user: { role: 'MANAGER' } }, {}, next);
  assertNextWithoutError(next);
});

/**
 * Unit test (AA05): no permission -> 403 FORBIDDEN (distinct from 401) and logged.
 */
test('requireRole blocks unauthorized roles with 403 and logs it', () => {
  const logger = createSecurityLoggerMock();
  const req = {
    user: { userId: 'u9', role: 'CUSTOMER' },
    ip: '127.0.0.1',
    method: 'GET',
    baseUrl: '/api/v1/users',
    path: '/',
    app: { locals: { securityLogger: logger } },
  };
  const next = mock.fn();

  requireRole(['MANAGER', 'EMPLOYEE'])(req, {}, next);

  assert.equal(lastError(next).status, 403);
  assert.equal(lastError(next).code, AuthErrorCode.FORBIDDEN);
  const [event, details] = loggedCalls(logger)[0];
  assert.equal(event, 'ACCESS_DENIED');
  assert.equal(details.reason, 'INSUFFICIENT_ROLE');
  assert.equal(details.userId, 'u9');
});

/**
 * Unit test: without req.user (middleware order error) it is also 403.
 */
test('requireRole blocks requests without an authenticated user', () => {
  const next = mock.fn();
  requireRole(['MANAGER'])({}, {}, next);
  assert.equal(lastError(next).status, 403);
});
