import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthController } from '../../src/api/auth/auth.controller.js';
import { AuthErrorCode, authError } from '../../src/application/auth/auth-errors.js';

const CONFIG = {
  cookie: { name: 'lp_rt', secure: true, sameSite: 'strict', path: '/api/v1/auth' },
};
const EXPIRES_AT = new Date('2026-11-09T10:00:00.000Z');
const SESSION_RESULT = {
  accessToken: 'access.jwt.token',
  expiresIn: 3600,
  refreshToken: 'opaque-refresh-token',
  refreshTokenExpiresAt: EXPIRES_AT,
  user: { id: 'u1', email: 'a@b.pt', role: 'EMPLOYEE', roles: ['EMPLOYEE'], status: 'active' },
};

/** Fake Express response that records cookies, status and body. */
function createDummyResponse() {
  return {
    cookies: [],
    cleared: [],
    statusCode: undefined,
    body: undefined,
    ended: false,
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

/** Minimal request. */
function createRequest({ body = {}, cookies = {}, user } = {}) {
  return { body, cookies, user, ip: '127.0.0.1', get: (h) => (h === 'user-agent' ? 'node-test' : undefined) };
}

/** Fake authService that records the calls. */
function createFakeAuthService(overrides = {}) {
  const calls = [];
  const record = (name, result) => async (...args) => {
    calls.push({ name, args });
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    calls,
    login: record('login', SESSION_RESULT),
    refresh: record('refresh', { ...SESSION_RESULT, refreshToken: 'rotated-refresh-token' }),
    logout: record('logout'),
    logoutAll: record('logoutAll'),
    resetPassword: record('resetPassword'),
    changePassword: record('changePassword'),
    requestPasswordReset: (...args) => calls.push({ name: 'requestPasswordReset', args }),
    ...overrides,
  };
}

/** Runs a controller action and returns { res, error }. */
async function run(action, req) {
  const res = createDummyResponse();
  let error;
  await action(req, res, (err) => {
    error = err;
  });
  return { res, error };
}

/**
 * Unit test: login -> 200 with the access token in the body and the refresh token ONLY in the cookie
 * (httpOnly, Secure, SameSite, restricted Path, expiry of the session).
 */
test('login returns the access token and sets the refresh cookie securely', async () => {
  const authService = createFakeAuthService();
  const controller = createAuthController({ authService, config: CONFIG });

  const { res } = await run(controller.login, createRequest({ body: { email: 'a@b.pt', password: 'x' } }));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    accessToken: 'access.jwt.token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: SESSION_RESULT.user,
  });
  assert.ok(!JSON.stringify(res.body).includes('opaque-refresh-token'));

  assert.deepEqual(res.cookies, [
    {
      name: 'lp_rt',
      value: 'opaque-refresh-token',
      options: { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth', expires: EXPIRES_AT },
    },
  ]);
  assert.deepEqual(authService.calls[0].args[1], { ip: '127.0.0.1', userAgent: 'node-test' });
});

/**
 * Unit test: login errors go to the errorHandler and no cookie is set.
 */
test('login forwards errors without setting a cookie', async () => {
  const failure = authError(AuthErrorCode.INVALID_CREDENTIALS, 401);
  const controller = createAuthController({
    authService: createFakeAuthService({ login: async () => Promise.reject(failure) }),
    config: CONFIG,
  });

  const { res, error } = await run(controller.login, createRequest());

  assert.equal(error, failure);
  assert.equal(res.cookies.length, 0);
});

/**
 * Unit test: refresh reads the cookie and sends the rotated one.
 */
test('refresh reads the cookie and rotates it', async () => {
  const authService = createFakeAuthService();
  const controller = createAuthController({ authService, config: CONFIG });

  const { res } = await run(controller.refresh, createRequest({ cookies: { lp_rt: 'current' } }));

  assert.equal(authService.calls[0].args[0], 'current');
  assert.equal(res.statusCode, 200);
  assert.equal(res.cookies[0].value, 'rotated-refresh-token');
});

/**
 * Unit test: failed refresh (401) clears the cookie.
 */
test('refresh clears the cookie when the session is invalid', async () => {
  const failure = authError(AuthErrorCode.REFRESH_INVALID, 401);
  const controller = createAuthController({
    authService: createFakeAuthService({ refresh: async () => Promise.reject(failure) }),
    config: CONFIG,
  });

  const { res, error } = await run(controller.refresh, createRequest());

  assert.equal(error, failure);
  assert.deepEqual(res.cleared, [
    { name: 'lp_rt', options: { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth' } },
  ]);
});

/**
 * Unit test: logout and logout-all -> 204 and clear the cookie.
 */
test('logout and logoutAll answer 204 and clear the cookie', async () => {
  const authService = createFakeAuthService();
  const controller = createAuthController({ authService, config: CONFIG });
  const user = { userId: 'u1', sessionId: 's1' };

  for (const action of [controller.logout, controller.logoutAll]) {
    const { res } = await run(action, createRequest({ user }));
    assert.equal(res.statusCode, 204);
    assert.ok(res.ended);
    assert.equal(res.cleared.length, 1);
  }
  assert.deepEqual(authService.calls.map((c) => c.args[0]), [user, user]);
});

/**
 * Unit test (non-enumeration): forgot always answers 202 with the same body.
 */
test('forgotPassword always answers 202 with the same body', async () => {
  const authService = createFakeAuthService();
  const controller = createAuthController({ authService, config: CONFIG });

  const { res } = await run(controller.forgotPassword, createRequest({ body: { email: 'x@y.pt' } }));

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { code: 'PASSWORD_RESET_REQUESTED' });
  assert.equal(authService.calls[0].name, 'requestPasswordReset');
});

/**
 * Unit test (security): changePassword uses the userId/sessionId of the session, never those of the body.
 */
test('changePassword takes the user and session from req.user, not from the body', async () => {
  const authService = createFakeAuthService();
  const controller = createAuthController({ authService, config: CONFIG });
  const req = createRequest({
    body: { currentPassword: 'a', newPassword: 'b', userId: 'attacker', sessionId: 'attacker' },
    user: { userId: 'u1', sessionId: 's1' },
  });

  const { res } = await run(controller.changePassword, req);

  assert.equal(res.statusCode, 204);
  assert.equal(authService.calls[0].args[0].userId, 'u1');
  assert.equal(authService.calls[0].args[0].sessionId, 's1');
});

/**
 * Unit test: resetPassword -> 204.
 */
test('resetPassword answers 204', async () => {
  const controller = createAuthController({ authService: createFakeAuthService(), config: CONFIG });
  const { res } = await run(controller.resetPassword, createRequest({ body: { token: 't', newPassword: 'p' } }));
  assert.equal(res.statusCode, 204);
});
