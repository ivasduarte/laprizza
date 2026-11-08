import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import { createAuthService, registerUser } from '../../src/application/auth/auth.service.js';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import { createPasswordHasher } from '../../src/infrastructure/security/password-hasher.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

const PASSWORD = 'StrongPassword123!';
const NEW_PASSWORD = 'NewStrongPassword123!';
const WRONG_PASSWORD = 'WrongPassword999!';
const REQUEST = { ip: '127.0.0.1', userAgent: 'node-test' };

const USER_ID = 'abcdef000000000000000001';
const SESSION_ID = 'bbbbbb000000000000000001';
const OTHER_SESSION_ID = 'bbbbbb000000000000000002';
const START = new Date('2026-11-02T10:00:00.000Z');

/** Same values as the loadConfig() defaults. */
const TEST_AUTH_CONFIG = Object.freeze({
  accessTokenTtlSeconds: 3600,
  refreshTokenTtlMs: 7 * 86_400_000,
  lockoutThreshold: 3,
  lockoutStepsMs: [60_000, 300_000, 1_800_000],
  unknownAccountThrottleRetentionMs: 86_400_000,
  passwordResetTtlMs: 30 * 60_000,
  passwordResetUrl: 'http://localhost:4200/reset-password',
});

/** Cheap Argon2 parameters: tests stay fast without changing the behaviour. */
const passwordHasher = createPasswordHasher({
  type: argon2.argon2id,
  memoryCost: 1024,
  timeCost: 1,
  parallelism: 1,
});
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

/** User document as returned by the users repository. */
const storedUser = (data = {}) => ({
  _id: USER_ID,
  email: 'user@laprizza.pt',
  role: 'EMPLOYEE',
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
  ...data,
});

/** Session document as returned by the sessions repository. */
const storedSession = (data = {}) => ({
  _id: SESSION_ID,
  userId: USER_ID,
  tokenVersion: 0,
  expiresAt: new Date(START.getTime() + TEST_AUTH_CONFIG.refreshTokenTtlMs),
  revokedAt: null,
  rotatedHashes: [],
  ...data,
});

/**
 * Builds the authentication service with mocked repositories, email service, logger and clock.
 * Every repository method starts "empty" (null / no-op) and is programmed by each test.
 * The password hasher and the token service are the real ones (pure, no I/O).
 */
function createAuthTestContext({ accessTokenTtlSeconds = 3600, loadRoles } = {}) {
  let now = new Date(START);
  const clock = { now: mock.fn(() => new Date(now)) };

  const usersRepository = {
    create: mock.fn(async (data) => ({ _id: USER_ID, ...data })),
    findById: mock.fn(async () => null),
    findByIdWithPasswordHash: mock.fn(async () => null),
    findByEmail: mock.fn(async () => null),
    findByEmailWithPasswordHash: mock.fn(async () => null),
    update: mock.fn(async () => null),
    registerFailedLogin: mock.fn(async () => null),
    extendLockout: mock.fn(async () => {}),
    clearLoginFailures: mock.fn(async () => {}),
    setPasswordHash: mock.fn(async () => null),
    incrementTokenVersion: mock.fn(async () => null),
  };
  const sessionsRepository = {
    create: mock.fn(async (data) => ({ _id: SESSION_ID, rotatedHashes: [], ...data })),
    findById: mock.fn(async () => null),
    rotateRefreshToken: mock.fn(async () => null),
    findByRotatedHash: mock.fn(async () => null),
    revoke: mock.fn(async () => {}),
    revokeAllForUser: mock.fn(async () => {}),
  };
  const resetTokensRepository = {
    create: mock.fn(async (data) => ({ usedAt: null, ...data })),
    invalidateActiveForUser: mock.fn(async () => {}),
    consume: mock.fn(async () => null),
  };
  const loginThrottleRepository = {
    findByKey: mock.fn(async () => null),
    registerFailure: mock.fn(async (keyHash) => ({ keyHash, failedCount: 1, lockedUntil: null })),
    extendLockout: mock.fn(async () => {}),
  };
  const emailService = { send: mock.fn(async () => {}) };
  const securityLogger = { log: mock.fn() };
  const tokenService = createTokenService({ jwtSecret: 'test_secret_key', accessTokenTtlSeconds });

  let pending = Promise.resolve();
  const service = createAuthService({
    usersRepository,
    sessionsRepository,
    resetTokensRepository,
    loginThrottleRepository,
    passwordHasher,
    emailService,
    securityLogger,
    tokenService,
    clock,
    config: TEST_AUTH_CONFIG,
    ...(loadRoles ? { loadRoles } : {}),
    defer: (task) => {
      pending = task();
    },
  });

  return {
    usersRepository,
    sessionsRepository,
    resetTokensRepository,
    loginThrottleRepository,
    emailService,
    securityLogger,
    tokenService,
    clock,
    service,
    /** Simulates the passing of time. */
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
    /** Waits for the work scheduled by requestPasswordReset. */
    flushDeferred: () => pending,
    /** Access token as issued for the given session. */
    accessToken: ({ sessionId = SESSION_ID, tokenVersion = 0 } = {}) =>
      tokenService.signAccessToken({ userId: USER_ID, sessionId, tokenVersion }),
  };
}

/** Details of the security events logged with the given name. */
const loggedEvents = (ctx, name) =>
  ctx.securityLogger.log.mock.calls
    .filter((c) => c.arguments[0] === name)
    .map((c) => c.arguments[1]);

/** Programs sessionsRepository.findById with a map of sessions by id. */
function programSessions(ctx, sessions) {
  ctx.sessionsRepository.findById.mock.mockImplementation(
    async (id) => sessions.find((s) => String(s._id) === String(id)) ?? null,
  );
}

/** Asserts that the promise is rejected with the given status and code. */
async function rejectsWith(promise, status, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

/** Extracts the recovery token from the last email sent. */
function tokenFromLastEmail(emailService) {
  const { text } = emailService.send.mock.calls.at(-1).arguments[0];
  return text.match(/#token=([A-Za-z0-9_-]{43})/)[1];
}

/* ===================================================================== */
/* registerUser                                                          */
/* ===================================================================== */

/**
 * Unit test: registerUser rejects weak passwords without touching the database.
 */
test('registerUser rejects weak passwords without saving to the database', async () => {
  const { usersRepository } = createAuthTestContext();
  await rejectsWith(
    registerUser({ email: 'teste@laprizza.pt', password: '123', role: 'EMPLOYEE' }, usersRepository),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  assert.equal(usersRepository.create.mock.callCount(), 0);
});

/**
 * Unit test: email is mandatory (it is the login identifier).
 */
test('registerUser requires an email', async () => {
  const { usersRepository } = createAuthTestContext();
  await assert.rejects(
    registerUser({ username: 'semEmail', password: PASSWORD, role: 'EMPLOYEE' }, usersRepository),
    (err) => err.status === 400,
  );
  assert.equal(usersRepository.create.mock.callCount(), 0);
});

/**
 * Unit test: stores only the Argon2id hash, normalizes the email and creates an ACTIVE account.
 */
test('registerUser stores only an argon2id hash and creates an active account', async () => {
  const { usersRepository } = createAuthTestContext();
  const dto = await registerUser(
    { email: '  Joao@LaPrizza.pt ', password: PASSWORD, role: 'EMPLOYEE' },
    usersRepository,
    passwordHasher,
  );

  const stored = usersRepository.create.mock.calls[0].arguments[0];
  assert.equal(stored.email, 'joao@laprizza.pt');
  assert.equal(stored.password, undefined);
  assert.match(stored.passwordHash, /^\$argon2id\$/);
  assert.notEqual(stored.passwordHash, PASSWORD);
  assert.equal(stored.status, 'active');
  assert.equal(stored.tokenVersion, 0);
  assert.equal(stored.failedLoginCount, 0);

  assert.equal(dto.status, 'active');
  assert.equal(dto.passwordHash, undefined);
});

/**
 * Unit test: only CUSTOMER can have a customerId.
 */
test('registerUser fails if customerId is provided but role is not CUSTOMER', async () => {
  const { usersRepository } = createAuthTestContext();
  await assert.rejects(
    registerUser(
      { email: 'x@x.pt', password: PASSWORD, role: 'EMPLOYEE', customerId: 'fakeid' },
      usersRepository,
    ),
    (err) => err.status === 400,
  );
  assert.equal(usersRepository.create.mock.callCount(), 0);
});

/**
 * Unit test: duplicate email -> 409.
 */
test('registerUser returns 409 Conflict on duplicate email', async () => {
  const { usersRepository } = createAuthTestContext();
  usersRepository.create.mock.mockImplementation(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000 });
  });
  const data = { email: 'duplicado@laprizza.pt', password: PASSWORD, role: 'EMPLOYEE' };

  await assert.rejects(registerUser(data, usersRepository, passwordHasher), (err) => err.status === 409);
});

/* ===================================================================== */
/* login + establishSession                                              */
/* ===================================================================== */

/**
 * Unit test: successful login.
 * Returns access token (minimal claims), opaque refresh token and the user without secrets;
 * the session stores only the hash of the refresh token.
 */
test('login returns tokens and creates a session storing only the refresh token hash', async () => {
  const ctx = createAuthTestContext();
  const user = storedUser();
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () => user);

  const result = await ctx.service.login({ email: user.email, password: PASSWORD }, REQUEST);

  assert.equal(result.expiresIn, 3600);
  assert.match(result.refreshToken, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(result.user, {
    id: USER_ID,
    email: user.email,
    role: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    status: 'active',
  });

  assert.equal(ctx.sessionsRepository.create.mock.callCount(), 1);
  const session = ctx.sessionsRepository.create.mock.calls[0].arguments[0];
  assert.equal(session.refreshTokenHash, ctx.tokenService.hashOpaqueToken(result.refreshToken));
  assert.notEqual(session.refreshTokenHash, result.refreshToken);
  assert.equal(session.ip, REQUEST.ip);
  assert.equal(session.userAgent, REQUEST.userAgent);
  assert.equal(session.expiresAt.getTime(), START.getTime() + TEST_AUTH_CONFIG.refreshTokenTtlMs);

  const claims = jwt.decode(result.accessToken);
  assert.equal(claims.sub, USER_ID);
  assert.equal(claims.sid, SESSION_ID);
  assert.equal(claims.tv, 0);
  assert.equal(claims.role, undefined);
});

/**
 * Unit test: the email is normalized at login.
 */
test('login normalizes the email', async () => {
  const ctx = createAuthTestContext();
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ email: 'case@laprizza.pt' }),
  );

  const result = await ctx.service.login({ email: '  CASE@LaPrizza.PT ', password: PASSWORD });

  assert.ok(result.accessToken);
  assert.equal(
    ctx.usersRepository.findByEmailWithPasswordHash.mock.calls[0].arguments[0],
    'case@laprizza.pt',
  );
});

/**
 * Unit test: non-enumeration.
 * Wrong password and non-existent account give exactly the same error (status, code and message).
 */
test('login returns the same error for wrong password and unknown account', async () => {
  const ctx = createAuthTestContext();
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async (email) =>
    email === 'user@laprizza.pt' ? storedUser() : null,
  );
  ctx.usersRepository.registerFailedLogin.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 1 }),
  );

  const wrongPassword = await ctx.service
    .login({ email: 'user@laprizza.pt', password: WRONG_PASSWORD })
    .catch((err) => err);
  const unknownAccount = await ctx.service
    .login({ email: 'ghost@laprizza.pt', password: WRONG_PASSWORD })
    .catch((err) => err);

  for (const err of [wrongPassword, unknownAccount]) {
    assert.equal(err.status, 401);
    assert.equal(err.code, AuthErrorCode.INVALID_CREDENTIALS);
  }
  assert.equal(wrongPassword.message, unknownAccount.message);
  assert.equal(ctx.sessionsRepository.create.mock.callCount(), 0);
});

/**
 * Unit test: timing mitigation.
 * For a non-existent account an Argon2 verification is still run against the fictitious hash.
 */
test('login runs a dummy Argon2 verification when the account does not exist', async (t) => {
  const ctx = createAuthTestContext();
  const verifyDummy = t.mock.method(passwordHasher, 'verifyDummy');

  await assert.rejects(ctx.service.login({ email: 'ghost@laprizza.pt', password: PASSWORD }));
  assert.equal(verifyDummy.mock.callCount(), 1);
  assert.equal(verifyDummy.mock.calls[0].arguments[0], PASSWORD);
});

/**
 * Unit test (AA05): failures are logged with a reason and without the password.
 */
test('login logs failed attempts without the password', async () => {
  const ctx = createAuthTestContext();
  const user = storedUser();
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () => user);
  ctx.usersRepository.registerFailedLogin.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 1 }),
  );

  await assert.rejects(ctx.service.login({ email: user.email, password: WRONG_PASSWORD }, REQUEST));

  const [event] = loggedEvents(ctx, 'LOGIN_FAILED');
  assert.equal(event.reason, 'INVALID_PASSWORD');
  assert.equal(event.email, user.email);
  assert.equal(event.ip, REQUEST.ip);
  assert.ok(!JSON.stringify(ctx.securityLogger.log.mock.calls.map((c) => c.arguments)).includes(WRONG_PASSWORD));
});

/**
 * Unit test: progressive wait.
 * After the 3rd consecutive failure even the correct password gets 429 (1 min);
 * once the wait is over, a correct login works and resets the counter.
 */
test('login locks the account after 3 failures and resets after a successful login', async () => {
  const ctx = createAuthTestContext();
  const { usersRepository } = ctx;
  const attempt = (password) => ctx.service.login({ email: 'user@laprizza.pt', password });

  // Step 1: three wrong passwords; the repository reports the incremented counter each time.
  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () => storedUser());
  for (const failedLoginCount of [1, 2, 3]) {
    usersRepository.registerFailedLogin.mock.mockImplementationOnce(async () =>
      storedUser({ failedLoginCount }),
    );
    await rejectsWith(attempt(WRONG_PASSWORD), 401, AuthErrorCode.INVALID_CREDENTIALS);
  }
  assert.equal(usersRepository.registerFailedLogin.mock.callCount(), 3);
  assert.equal(usersRepository.extendLockout.mock.callCount(), 1); // only from the 3rd failure on
  assert.deepEqual(usersRepository.extendLockout.mock.calls[0].arguments, [
    USER_ID,
    new Date(START.getTime() + 60_000),
  ]);

  // Step 2: the account is locked for 1 minute, even with the correct password.
  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 3, lockedUntil: new Date(START.getTime() + 60_000) }),
  );
  const locked = await attempt(PASSWORD).catch((err) => err);
  assert.equal(locked.status, 429);
  assert.equal(locked.code, AuthErrorCode.TOO_MANY_ATTEMPTS);
  assert.equal(locked.retryAfterSeconds, 60);

  // Step 3: once the wait is over the correct password works and the counters are reset.
  ctx.advance(60_000);
  await attempt(PASSWORD);

  assert.deepEqual(usersRepository.clearLoginFailures.mock.calls[0].arguments, [USER_ID]);
  assert.equal(ctx.sessionsRepository.create.mock.callCount(), 1);
});

/**
 * Unit test: the wait grows on each new failure (1 min -> 5 min -> 30 min).
 */
test('login increases the wait on each further failure', async () => {
  const ctx = createAuthTestContext();
  const { usersRepository } = ctx;
  const attempt = (password) => ctx.service.login({ email: 'user@laprizza.pt', password });
  const lockedUntil = () => usersRepository.extendLockout.mock.calls.at(-1).arguments[1];

  // The 1 minute wait after the 3rd failure is over.
  ctx.advance(60_000);
  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 3, lockedUntil: new Date(START.getTime() + 60_000) }),
  );

  // 4th failure -> 5 minutes
  usersRepository.registerFailedLogin.mock.mockImplementationOnce(async () =>
    storedUser({ failedLoginCount: 4 }),
  );
  await rejectsWith(attempt(WRONG_PASSWORD), 401, AuthErrorCode.INVALID_CREDENTIALS);
  assert.equal(lockedUntil().getTime(), ctx.clock.now().getTime() + 300_000);

  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 4, lockedUntil: lockedUntil() }),
  );
  assert.equal((await attempt(PASSWORD).catch((err) => err)).retryAfterSeconds, 300);

  // 5th failure -> 30 minutes
  ctx.advance(300_000);
  usersRepository.registerFailedLogin.mock.mockImplementationOnce(async () =>
    storedUser({ failedLoginCount: 5 }),
  );
  await assert.rejects(attempt(WRONG_PASSWORD));
  assert.equal(lockedUntil().getTime(), ctx.clock.now().getTime() + 1_800_000);

  usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 5, lockedUntil: lockedUntil() }),
  );
  assert.equal((await attempt(PASSWORD).catch((err) => err)).retryAfterSeconds, 1800);
});

/**
 * Unit test: non-enumeration in the wait.
 * Non-existent emails also enter the wait, with the same 429.
 */
test('login applies the same lockout to unknown emails', async () => {
  const ctx = createAuthTestContext();
  const { loginThrottleRepository } = ctx;
  const attempt = () => ctx.service.login({ email: 'ghost@laprizza.pt', password: WRONG_PASSWORD });

  for (const failedCount of [1, 2, 3]) {
    loginThrottleRepository.registerFailure.mock.mockImplementationOnce(async (keyHash) => ({
      keyHash,
      failedCount,
      lockedUntil: null,
    }));
    await rejectsWith(attempt(), 401, AuthErrorCode.INVALID_CREDENTIALS);
  }

  // The unknown email is never stored in plain text.
  const [keyHash, until] = loginThrottleRepository.extendLockout.mock.calls[0].arguments;
  assert.notEqual(keyHash, 'ghost@laprizza.pt');
  assert.equal(keyHash, ctx.tokenService.hashOpaqueToken('ghost@laprizza.pt'));
  assert.equal(until.getTime(), START.getTime() + 60_000);

  loginThrottleRepository.findByKey.mock.mockImplementation(async () => ({
    keyHash,
    failedCount: 3,
    lockedUntil: until,
  }));
  const locked = await attempt().catch((err) => err);
  assert.equal(locked.status, 429);
  assert.equal(locked.code, AuthErrorCode.TOO_MANY_ATTEMPTS);
  assert.equal(locked.retryAfterSeconds, 60);
});

/**
 * Unit test: inactive/disabled account.
 * With the correct password: 403 with its own code and no session; with the wrong one: 401 (the state is not revealed).
 */
test('login rejects inactive and disabled accounts only after a correct password', async () => {
  const ctx = createAuthTestContext();
  const accounts = {
    'inactive@laprizza.pt': storedUser({ email: 'inactive@laprizza.pt', status: 'inactive' }),
    'disabled@laprizza.pt': storedUser({ email: 'disabled@laprizza.pt', status: 'disabled' }),
  };
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(
    async (email) => accounts[email] ?? null,
  );
  ctx.usersRepository.registerFailedLogin.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 1 }),
  );

  await rejectsWith(
    ctx.service.login({ email: 'inactive@laprizza.pt', password: PASSWORD }),
    403,
    AuthErrorCode.ACCOUNT_INACTIVE,
  );
  await rejectsWith(
    ctx.service.login({ email: 'disabled@laprizza.pt', password: PASSWORD }),
    403,
    AuthErrorCode.ACCOUNT_DISABLED,
  );
  await rejectsWith(
    ctx.service.login({ email: 'disabled@laprizza.pt', password: WRONG_PASSWORD }),
    401,
    AuthErrorCode.INVALID_CREDENTIALS,
  );
  assert.equal(ctx.sessionsRepository.create.mock.callCount(), 0);
});

/**
 * Unit test (AA02 extension point): establishSession can be called directly
 * by another authentication method and uses loadRoles.
 */
test('establishSession is reusable and loads roles through the extension point', async () => {
  const loadRoles = mock.fn(async () => ['CUSTOMER', 'BETA']);
  const ctx = createAuthTestContext({ loadRoles });
  const user = storedUser();

  const result = await ctx.service.establishSession(user, { method: 'oidc', ip: '10.0.0.1' });

  assert.deepEqual(result.user.roles, ['CUSTOMER', 'BETA']);
  assert.equal(loadRoles.mock.calls[0].arguments[0], user);
  const [event] = loggedEvents(ctx, 'LOGIN_SUCCEEDED');
  assert.equal(event.method, 'oidc');
});

/* ===================================================================== */
/* authenticateAccessToken (used by the middleware)                     */
/* ===================================================================== */

/** Context with an active user and its active session (the state right after login). */
function loggedIn(options) {
  const ctx = createAuthTestContext(options);
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser());
  programSessions(ctx, [storedSession()]);
  return ctx;
}

/**
 * Unit test: a valid token returns the user with the role read from the database.
 */
test('authenticateAccessToken returns the current role from the database', async () => {
  const ctx = loggedIn();
  const accessToken = ctx.accessToken();

  const auth = await ctx.service.authenticateAccessToken(accessToken);
  assert.equal(auth.userId, USER_ID);
  assert.equal(auth.role, 'EMPLOYEE');
  assert.equal(auth.sessionId, SESSION_ID);
  assert.equal(ctx.usersRepository.findById.mock.calls[0].arguments[0], USER_ID);
  assert.equal(ctx.sessionsRepository.findById.mock.calls[0].arguments[0], SESSION_ID);

  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser({ role: 'MANAGER' }));
  assert.equal((await ctx.service.authenticateAccessToken(accessToken)).role, 'MANAGER');
});

/**
 * Unit test: expired token -> TOKEN_EXPIRED; tampered token -> TOKEN_INVALID.
 */
test('authenticateAccessToken distinguishes expired and invalid tokens', async () => {
  const ctx = loggedIn({ accessTokenTtlSeconds: -1 });
  await rejectsWith(ctx.service.authenticateAccessToken(ctx.accessToken()), 401, AuthErrorCode.TOKEN_EXPIRED);
  await rejectsWith(ctx.service.authenticateAccessToken('abc.def.ghi'), 401, AuthErrorCode.TOKEN_INVALID);
  // Invalid tokens never reach the database.
  assert.equal(ctx.usersRepository.findById.mock.callCount(), 0);
});

/**
 * Unit test: the token stops working when the account is disabled, when tokenVersion changes
 * or when the session expires.
 */
test('authenticateAccessToken rejects tokens of disabled users, old token versions and expired sessions', async () => {
  const disabledCase = loggedIn();
  disabledCase.usersRepository.findById.mock.mockImplementation(async () =>
    storedUser({ status: 'disabled' }),
  );
  await rejectsWith(
    disabledCase.service.authenticateAccessToken(disabledCase.accessToken()),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );

  const versionCase = loggedIn();
  versionCase.usersRepository.findById.mock.mockImplementation(async () =>
    storedUser({ tokenVersion: 1 }),
  );
  await rejectsWith(
    versionCase.service.authenticateAccessToken(versionCase.accessToken()),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );

  const expiredCase = loggedIn();
  expiredCase.advance(TEST_AUTH_CONFIG.refreshTokenTtlMs + 1);
  await rejectsWith(
    expiredCase.service.authenticateAccessToken(expiredCase.accessToken()),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );
});

/* ===================================================================== */
/* refresh                                                               */
/* ===================================================================== */

/** Programs rotateRefreshToken to succeed, returning the session with the new hash. */
function rotationSucceeds(ctx, session = storedSession()) {
  ctx.sessionsRepository.rotateRefreshToken.mock.mockImplementation(
    async (currentHash, nextHash, now) => ({
      ...session,
      rotatedHashes: [...session.rotatedHashes, currentHash],
      refreshTokenHash: nextHash,
      lastUsedAt: now,
    }),
  );
}

/**
 * Unit test: refresh rotates the token, keeps the session and issues a valid access token.
 */
test('refresh rotates the refresh token and issues a working access token', async () => {
  const ctx = loggedIn();
  const refreshToken = ctx.tokenService.generateOpaqueToken();
  rotationSucceeds(ctx);

  const refreshed = await ctx.service.refresh(refreshToken, REQUEST);

  assert.notEqual(refreshed.refreshToken, refreshToken);
  const [currentHash, nextHash, now] = ctx.sessionsRepository.rotateRefreshToken.mock.calls[0].arguments;
  assert.equal(currentHash, ctx.tokenService.hashOpaqueToken(refreshToken));
  assert.equal(nextHash, ctx.tokenService.hashOpaqueToken(refreshed.refreshToken));
  assert.equal(now.getTime(), START.getTime());
  // Absolute expiry: refresh does not extend the session.
  assert.equal(refreshed.refreshTokenExpiresAt.getTime(), storedSession().expiresAt.getTime());
  await ctx.service.authenticateAccessToken(refreshed.accessToken);
});

/**
 * Unit test: theft detection.
 * Reusing a rotated refresh token revokes the whole session (including the new token).
 */
test('refresh revokes the session when a rotated token is reused', async () => {
  const ctx = loggedIn();
  const refreshToken = ctx.tokenService.generateOpaqueToken();

  // Step 1: legitimate rotation.
  rotationSucceeds(ctx);
  const refreshed = await ctx.service.refresh(refreshToken);

  // Step 2: the old token is no longer current, but it is found among the rotated hashes.
  ctx.sessionsRepository.rotateRefreshToken.mock.mockImplementation(async () => null);
  ctx.sessionsRepository.findByRotatedHash.mock.mockImplementation(async () => storedSession());
  await rejectsWith(ctx.service.refresh(refreshToken), 401, AuthErrorCode.REFRESH_INVALID);

  assert.equal(
    ctx.sessionsRepository.findByRotatedHash.mock.calls[0].arguments[0],
    ctx.tokenService.hashOpaqueToken(refreshToken),
  );
  assert.deepEqual(ctx.sessionsRepository.revoke.mock.calls[0].arguments, [SESSION_ID, START]);
  assert.equal(loggedEvents(ctx, 'REFRESH_TOKEN_REUSE').length, 1);

  // Step 3: the session is now revoked, so the new tokens stop working too.
  const revoked = storedSession({ revokedAt: START });
  ctx.sessionsRepository.findByRotatedHash.mock.mockImplementation(async () => revoked);
  programSessions(ctx, [revoked]);
  await rejectsWith(ctx.service.refresh(refreshed.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
  await rejectsWith(
    ctx.service.authenticateAccessToken(refreshed.accessToken),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );
  assert.equal(ctx.sessionsRepository.revoke.mock.callCount(), 1); // not revoked twice
});

/**
 * Unit test: missing, unknown or expired refresh token -> REFRESH_INVALID.
 */
test('refresh rejects missing, unknown and expired tokens', async () => {
  const ctx = loggedIn();

  await rejectsWith(ctx.service.refresh(undefined), 401, AuthErrorCode.REFRESH_INVALID);
  assert.equal(ctx.sessionsRepository.rotateRefreshToken.mock.callCount(), 0);

  await rejectsWith(
    ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
    401,
    AuthErrorCode.REFRESH_INVALID,
  );
  assert.equal(loggedEvents(ctx, 'REFRESH_FAILED')[0].reason, 'UNKNOWN_REVOKED_OR_EXPIRED');

  // The expiry is enforced by the repository with the current time.
  ctx.advance(TEST_AUTH_CONFIG.refreshTokenTtlMs + 1);
  await rejectsWith(
    ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
    401,
    AuthErrorCode.REFRESH_INVALID,
  );
  assert.equal(
    ctx.sessionsRepository.rotateRefreshToken.mock.calls.at(-1).arguments[2].getTime(),
    START.getTime() + TEST_AUTH_CONFIG.refreshTokenTtlMs + 1,
  );
});

/**
 * Unit test: refresh of a session whose user was disabled -> SESSION_REVOKED and the session is revoked.
 */
test('refresh rejects sessions of disabled users', async () => {
  const ctx = loggedIn();
  rotationSucceeds(ctx);
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser({ status: 'disabled' }));

  await rejectsWith(
    ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );
  assert.deepEqual(ctx.sessionsRepository.revoke.mock.calls[0].arguments, [SESSION_ID, START]);
});

/* ===================================================================== */
/* logout / logoutAll                                                    */
/* ===================================================================== */

/**
 * Unit test: logout ends only the current session; the others stay valid.
 */
test('logout revokes only the current session', async () => {
  const ctx = loggedIn();
  programSessions(ctx, [storedSession(), storedSession({ _id: OTHER_SESSION_ID })]);
  const accessA = ctx.accessToken({ sessionId: SESSION_ID });
  const accessB = ctx.accessToken({ sessionId: OTHER_SESSION_ID });

  const authA = await ctx.service.authenticateAccessToken(accessA);
  await ctx.service.logout(authA);

  assert.equal(ctx.sessionsRepository.revoke.mock.callCount(), 1);
  assert.deepEqual(ctx.sessionsRepository.revoke.mock.calls[0].arguments, [SESSION_ID, START]);

  // Next step: session A is revoked, B is untouched.
  programSessions(ctx, [
    storedSession({ revokedAt: START }),
    storedSession({ _id: OTHER_SESSION_ID }),
  ]);
  await rejectsWith(ctx.service.authenticateAccessToken(accessA), 401, AuthErrorCode.SESSION_REVOKED);
  await rejectsWith(
    ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
    401,
    AuthErrorCode.REFRESH_INVALID,
  );
  await ctx.service.authenticateAccessToken(accessB);
});

/**
 * Unit test: logoutAll ends every session and increments tokenVersion.
 */
test('logoutAll revokes every session and increments tokenVersion', async () => {
  const ctx = loggedIn();
  programSessions(ctx, [storedSession(), storedSession({ _id: OTHER_SESSION_ID })]);
  const tokens = [
    ctx.accessToken({ sessionId: SESSION_ID }),
    ctx.accessToken({ sessionId: OTHER_SESSION_ID }),
  ];

  await ctx.service.logoutAll(await ctx.service.authenticateAccessToken(tokens[0]));

  assert.deepEqual(ctx.usersRepository.incrementTokenVersion.mock.calls[0].arguments, [USER_ID]);
  assert.deepEqual(ctx.sessionsRepository.revokeAllForUser.mock.calls[0].arguments, [USER_ID, START]);

  // Next step: the user now has tokenVersion 1 and every session is revoked.
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser({ tokenVersion: 1 }));
  for (const accessToken of tokens) {
    await rejectsWith(ctx.service.authenticateAccessToken(accessToken), 401, AuthErrorCode.SESSION_REVOKED);
    await rejectsWith(
      ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
      401,
      AuthErrorCode.REFRESH_INVALID,
    );
  }
});

/* ===================================================================== */
/* requestPasswordReset / resetPassword                                  */
/* ===================================================================== */

/**
 * Unit test: recovery request for an active account.
 * Sends an email with the link (token in the fragment), stores only the hash and expires in 30 min.
 */
test('requestPasswordReset emails a single-use link and stores only the token hash', async () => {
  const ctx = createAuthTestContext();
  const user = storedUser();
  ctx.usersRepository.findByEmail.mock.mockImplementation(async () => user);

  const returned = ctx.service.requestPasswordReset({ email: user.email }, REQUEST);
  assert.equal(returned, undefined); // nothing that depends on the account is returned
  await ctx.flushDeferred();

  assert.equal(ctx.emailService.send.mock.callCount(), 1);
  const email = ctx.emailService.send.mock.calls[0].arguments[0];
  assert.equal(email.to, user.email);
  assert.ok(email.text.includes(`${TEST_AUTH_CONFIG.passwordResetUrl}#token=`));
  assert.ok(email.text.includes('30 minutos'));
  assert.ok(!email.text.includes('${'));

  const token = tokenFromLastEmail(ctx.emailService);
  assert.deepEqual(ctx.resetTokensRepository.invalidateActiveForUser.mock.calls[0].arguments, [USER_ID]);
  const record = ctx.resetTokensRepository.create.mock.calls[0].arguments[0];
  assert.equal(record.tokenHash, ctx.tokenService.hashOpaqueToken(token));
  assert.notEqual(record.tokenHash, token);
  assert.equal(record.expiresAt.getTime(), START.getTime() + TEST_AUTH_CONFIG.passwordResetTtlMs);
});

/**
 * Unit test: unknown, inactive or disabled accounts do not receive an email (and nothing fails).
 */
test('requestPasswordReset sends nothing for unknown, inactive or disabled accounts', async () => {
  const ctx = createAuthTestContext();
  const accounts = {
    'inactive@laprizza.pt': storedUser({ email: 'inactive@laprizza.pt', status: 'inactive' }),
    'disabled@laprizza.pt': storedUser({ email: 'disabled@laprizza.pt', status: 'disabled' }),
  };
  ctx.usersRepository.findByEmail.mock.mockImplementation(async (email) => accounts[email] ?? null);

  for (const email of ['ghost@laprizza.pt', 'inactive@laprizza.pt', 'disabled@laprizza.pt']) {
    ctx.service.requestPasswordReset({ email });
    await ctx.flushDeferred();
  }

  assert.equal(ctx.usersRepository.findByEmail.mock.callCount(), 3);
  assert.equal(ctx.emailService.send.mock.callCount(), 0);
  assert.equal(ctx.resetTokensRepository.create.mock.callCount(), 0);
  assert.equal(loggedEvents(ctx, 'PASSWORD_RESET_IGNORED').length, 3);
});

/**
 * Unit test: email errors do not propagate (the response is already 202) and are logged.
 */
test('requestPasswordReset logs email failures instead of throwing', async () => {
  const ctx = createAuthTestContext();
  ctx.usersRepository.findByEmail.mock.mockImplementation(async () => storedUser());
  ctx.emailService.send.mock.mockImplementation(async () => {
    throw new Error('SMTP unavailable');
  });

  ctx.service.requestPasswordReset({ email: 'user@laprizza.pt' });
  await ctx.flushDeferred();

  const [event] = loggedEvents(ctx, 'PASSWORD_RESET_ERROR');
  assert.equal(event.reason, 'SMTP unavailable');
});

/**
 * Unit test: successful reset.
 * New password works, old one does not, tokenVersion increments and every session ends.
 */
test('resetPassword changes the password and revokes every session', async () => {
  const ctx = loggedIn();
  ctx.usersRepository.findByEmail.mock.mockImplementation(async () => storedUser());
  ctx.service.requestPasswordReset({ email: 'user@laprizza.pt' });
  await ctx.flushDeferred();
  const token = tokenFromLastEmail(ctx.emailService);

  ctx.resetTokensRepository.consume.mock.mockImplementationOnce(async (tokenHash) => ({
    tokenHash,
    userId: USER_ID,
  }));
  await ctx.service.resetPassword({ token, newPassword: NEW_PASSWORD });

  assert.deepEqual(ctx.resetTokensRepository.consume.mock.calls[0].arguments, [
    ctx.tokenService.hashOpaqueToken(token),
    START,
  ]);
  const [userId, newHash, options] = ctx.usersRepository.setPasswordHash.mock.calls[0].arguments;
  assert.equal(userId, USER_ID);
  assert.deepEqual(options, { revokeTokens: true }); // tokenVersion is incremented
  assert.equal(await passwordHasher.verify(newHash, NEW_PASSWORD), true);
  assert.equal(await passwordHasher.verify(newHash, PASSWORD), false);
  assert.deepEqual(ctx.sessionsRepository.revokeAllForUser.mock.calls[0].arguments, [USER_ID, START]);

  // Next step: the stored user has the new hash and tokenVersion 1.
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser({ tokenVersion: 1 }));
  await rejectsWith(ctx.service.authenticateAccessToken(ctx.accessToken()), 401, AuthErrorCode.SESSION_REVOKED);
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ passwordHash: newHash, tokenVersion: 1 }),
  );
  ctx.usersRepository.registerFailedLogin.mock.mockImplementation(async () =>
    storedUser({ failedLoginCount: 1 }),
  );
  await rejectsWith(
    ctx.service.login({ email: 'user@laprizza.pt', password: PASSWORD }),
    401,
    AuthErrorCode.INVALID_CREDENTIALS,
  );
  await ctx.service.login({ email: 'user@laprizza.pt', password: NEW_PASSWORD });
});

/**
 * Unit test: single use, expiry and invalidation of previous tokens.
 */
test('resetPassword tokens are single-use, expire after 30 minutes and are replaced by new requests', async () => {
  const ctx = createAuthTestContext();
  ctx.usersRepository.findByEmail.mock.mockImplementation(async () => storedUser());
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser());
  const { consume, invalidateActiveForUser } = ctx.resetTokensRepository;
  const request = async () => {
    ctx.service.requestPasswordReset({ email: 'user@laprizza.pt' });
    await ctx.flushDeferred();
    return tokenFromLastEmail(ctx.emailService);
  };

  // Single use: the first consume succeeds, the repository reports nothing on the second one
  const used = await request();
  consume.mock.mockImplementationOnce(async (tokenHash) => ({ tokenHash, userId: USER_ID }));
  await ctx.service.resetPassword({ token: used, newPassword: NEW_PASSWORD });
  await rejectsWith(
    ctx.service.resetPassword({ token: used, newPassword: NEW_PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );
  assert.equal(ctx.usersRepository.setPasswordHash.mock.callCount(), 1);

  // A new request invalidates the previous one
  const first = await request();
  const second = await request();
  assert.notEqual(first, second);
  assert.equal(invalidateActiveForUser.mock.callCount(), 3); // once per request
  await rejectsWith(
    ctx.service.resetPassword({ token: first, newPassword: PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );

  // Expiry (30 min): the repository receives the current time to compare with expiresAt
  ctx.advance(TEST_AUTH_CONFIG.passwordResetTtlMs + 1);
  await rejectsWith(
    ctx.service.resetPassword({ token: second, newPassword: PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );
  const [tokenHash, now] = consume.mock.calls.at(-1).arguments;
  assert.equal(tokenHash, ctx.tokenService.hashOpaqueToken(second));
  assert.equal(now.getTime(), START.getTime() + TEST_AUTH_CONFIG.passwordResetTtlMs + 1);
  const record = ctx.resetTokensRepository.create.mock.calls.at(-1).arguments[0];
  assert.ok(record.expiresAt < now);
});

/**
 * Unit test: a password that breaks the policy does not consume the token.
 */
test('resetPassword validates the policy before consuming the token', async () => {
  const ctx = createAuthTestContext();
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser());
  const token = ctx.tokenService.generateOpaqueToken();

  await rejectsWith(
    ctx.service.resetPassword({ token, newPassword: 'fraca' }),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  assert.equal(ctx.resetTokensRepository.consume.mock.callCount(), 0);

  ctx.resetTokensRepository.consume.mock.mockImplementationOnce(async (tokenHash) => ({
    tokenHash,
    userId: USER_ID,
  }));
  await ctx.service.resetPassword({ token, newPassword: NEW_PASSWORD });
  assert.equal(ctx.resetTokensRepository.consume.mock.callCount(), 1);
});

/**
 * Unit test: the account was disabled after the request -> the token does not work.
 */
test('resetPassword rejects tokens of accounts that are no longer active', async () => {
  const ctx = createAuthTestContext();
  ctx.resetTokensRepository.consume.mock.mockImplementation(async (tokenHash) => ({
    tokenHash,
    userId: USER_ID,
  }));
  ctx.usersRepository.findById.mock.mockImplementation(async () => storedUser({ status: 'disabled' }));

  await rejectsWith(
    ctx.service.resetPassword({ token: ctx.tokenService.generateOpaqueToken(), newPassword: NEW_PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );
  assert.equal(ctx.usersRepository.setPasswordHash.mock.callCount(), 0);
  assert.equal(loggedEvents(ctx, 'PASSWORD_RESET_FAILED')[0].reason, 'ACCOUNT_NOT_ACTIVE');
});

/* ===================================================================== */
/* changePassword                                                        */
/* ===================================================================== */

/**
 * Unit test: requires the current password and validates the policy of the new one.
 */
test('changePassword requires the current password and enforces the policy', async () => {
  const ctx = loggedIn();
  ctx.usersRepository.findByIdWithPasswordHash.mock.mockImplementation(async () => storedUser());
  const auth = await ctx.service.authenticateAccessToken(ctx.accessToken());

  await rejectsWith(
    ctx.service.changePassword({ ...auth, currentPassword: WRONG_PASSWORD, newPassword: NEW_PASSWORD }),
    400,
    AuthErrorCode.CURRENT_PASSWORD_INCORRECT,
  );
  await rejectsWith(
    ctx.service.changePassword({ ...auth, currentPassword: PASSWORD, newPassword: 'fraca' }),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  // The password stays the same
  assert.equal(ctx.usersRepository.setPasswordHash.mock.callCount(), 0);
  assert.equal(ctx.sessionsRepository.revokeAllForUser.mock.callCount(), 0);
});

/**
 * Unit test: successful change keeps the current session and revokes the others.
 */
test('changePassword keeps the current session and revokes the others', async () => {
  const ctx = loggedIn();
  programSessions(ctx, [storedSession(), storedSession({ _id: OTHER_SESSION_ID })]);
  ctx.usersRepository.findByIdWithPasswordHash.mock.mockImplementation(async () => storedUser());
  const current = ctx.accessToken({ sessionId: SESSION_ID });
  const other = ctx.accessToken({ sessionId: OTHER_SESSION_ID });
  const auth = await ctx.service.authenticateAccessToken(current);

  await ctx.service.changePassword({ ...auth, currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

  const [userId, newHash] = ctx.usersRepository.setPasswordHash.mock.calls[0].arguments;
  assert.equal(userId, USER_ID);
  assert.equal(await passwordHasher.verify(newHash, NEW_PASSWORD), true);
  assert.deepEqual(ctx.sessionsRepository.revokeAllForUser.mock.calls[0].arguments, [
    USER_ID,
    START,
    { exceptSessionId: SESSION_ID },
  ]);

  // Next step: only the other session is revoked and the stored hash is the new one.
  programSessions(ctx, [storedSession(), storedSession({ _id: OTHER_SESSION_ID, revokedAt: START })]);
  await ctx.service.authenticateAccessToken(current);
  await rejectsWith(ctx.service.authenticateAccessToken(other), 401, AuthErrorCode.SESSION_REVOKED);
  ctx.usersRepository.findByEmailWithPasswordHash.mock.mockImplementation(async () =>
    storedUser({ passwordHash: newHash }),
  );
  await ctx.service.login({ email: 'user@laprizza.pt', password: NEW_PASSWORD });
});
