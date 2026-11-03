import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { registerUser } from '../../src/application/auth/auth.service.js';
import { AuthErrorCode } from '../../src/application/auth/auth-errors.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createAuthTestContext, TEST_AUTH_CONFIG } from '../infrastructure/auth.dummy.dependencies.js';

const PASSWORD = 'StrongPassword123!';
const NEW_PASSWORD = 'NewStrongPassword123!';
const WRONG_PASSWORD = 'WrongPassword999!';
const REQUEST = { ip: '127.0.0.1', userAgent: 'node-test' };

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
  const { text } = emailService.sent.at(-1);
  return text.match(/#token=([A-Za-z0-9_-]{43})/)[1];
}

/* ===================================================================== */
/* registerUser                                                          */
/* ===================================================================== */

/**
 * Unit test: registerUser rejects weak passwords without touching the database.
 */
test('registerUser rejects weak passwords without saving to the database', async () => {
  const usersRepository = createDummyUsersRepository();
  await rejectsWith(
    registerUser({ email: 'teste@laprizza.pt', password: '123', role: 'EMPLOYEE' }, usersRepository),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  assert.equal(usersRepository._getUsers().length, 0);
});

/**
 * Unit test: email is mandatory (it is the login identifier).
 */
test('registerUser requires an email', async () => {
  const usersRepository = createDummyUsersRepository();
  await assert.rejects(
    registerUser({ username: 'semEmail', password: PASSWORD, role: 'EMPLOYEE' }, usersRepository),
    (err) => err.status === 400,
  );
});

/**
 * Unit test: stores only the Argon2id hash, normalizes the email and creates an ACTIVE account.
 */
test('registerUser stores only an argon2id hash and creates an active account', async () => {
  const { usersRepository, passwordHasher } = createAuthTestContext();
  const dto = await registerUser(
    { email: '  Joao@LaPrizza.pt ', password: PASSWORD, role: 'EMPLOYEE' },
    usersRepository,
    passwordHasher,
  );

  const stored = usersRepository._getUsers()[0];
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
  await assert.rejects(
    registerUser(
      { email: 'x@x.pt', password: PASSWORD, role: 'EMPLOYEE', customerId: 'fakeid' },
      createDummyUsersRepository(),
    ),
    (err) => err.status === 400,
  );
});

/**
 * Unit test: duplicate email -> 409.
 */
test('registerUser returns 409 Conflict on duplicate email', async () => {
  const { usersRepository, passwordHasher } = createAuthTestContext();
  const data = { email: 'duplicado@laprizza.pt', password: PASSWORD, role: 'EMPLOYEE' };
  await registerUser(data, usersRepository, passwordHasher);
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
  const ctx = await createAuthTestContext();
  const user = await ctx.createUser();

  const result = await ctx.service.login({ email: user.email, password: PASSWORD }, REQUEST);

  assert.equal(result.expiresIn, 3600);
  assert.match(result.refreshToken, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(result.user, {
    id: String(user.id),
    email: user.email,
    role: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    status: 'active',
  });

  const [session] = ctx.sessionsRepository._getSessions();
  assert.equal(session.refreshTokenHash, ctx.tokenService.hashOpaqueToken(result.refreshToken));
  assert.notEqual(session.refreshTokenHash, result.refreshToken);
  assert.equal(session.ip, REQUEST.ip);
  assert.equal(session.userAgent, REQUEST.userAgent);
  assert.equal(
    session.expiresAt.getTime(),
    ctx.clock.now().getTime() + TEST_AUTH_CONFIG.refreshTokenTtlMs,
  );

  const claims = jwt.decode(result.accessToken);
  assert.equal(claims.sub, String(user.id));
  assert.equal(claims.sid, String(session._id));
  assert.equal(claims.tv, 0);
  assert.equal(claims.role, undefined);
});

/**
 * Unit test: the email is normalized at login.
 */
test('login normalizes the email', async () => {
  const ctx = createAuthTestContext();
  await ctx.createUser({ email: 'case@laprizza.pt' });
  const result = await ctx.service.login({ email: '  CASE@LaPrizza.PT ', password: PASSWORD });
  assert.ok(result.accessToken);
});

/**
 * Unit test: non-enumeration.
 * Wrong password and non-existent account give exactly the same error (status, code and message).
 */
test('login returns the same error for wrong password and unknown account', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();

  const wrongPassword = await ctx.service
    .login({ email: user.email, password: WRONG_PASSWORD })
    .catch((err) => err);
  const unknownAccount = await ctx.service
    .login({ email: 'ghost@laprizza.pt', password: WRONG_PASSWORD })
    .catch((err) => err);

  for (const err of [wrongPassword, unknownAccount]) {
    assert.equal(err.status, 401);
    assert.equal(err.code, AuthErrorCode.INVALID_CREDENTIALS);
  }
  assert.equal(wrongPassword.message, unknownAccount.message);
});

/**
 * Unit test: timing mitigation.
 * For a non-existent account an Argon2 verification is still run against the fictitious hash.
 */
test('login runs a dummy Argon2 verification when the account does not exist', async () => {
  const ctx = createAuthTestContext();
  let dummyCalls = 0;
  const originalVerifyDummy = ctx.passwordHasher.verifyDummy;
  ctx.passwordHasher.verifyDummy = async (plain) => {
    dummyCalls += 1;
    return originalVerifyDummy(plain);
  };

  await assert.rejects(ctx.service.login({ email: 'ghost@laprizza.pt', password: PASSWORD }));
  assert.equal(dummyCalls, 1);
});

/**
 * Unit test (AA05): failures are logged with a reason and without the password.
 */
test('login logs failed attempts without the password', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  await assert.rejects(ctx.service.login({ email: user.email, password: WRONG_PASSWORD }, REQUEST));

  const event = ctx.securityLogger.events.find((e) => e.event === 'LOGIN_FAILED');
  assert.equal(event.reason, 'INVALID_PASSWORD');
  assert.equal(event.email, user.email);
  assert.equal(event.ip, REQUEST.ip);
  assert.ok(!JSON.stringify(ctx.securityLogger.events).includes(WRONG_PASSWORD));
});

/**
 * Unit test: progressive wait.
 * After the 3rd consecutive failure even the correct password gets 429 (1 min);
 * once the wait is over, a correct login works and resets the counter.
 */
test('login locks the account after 3 failures and resets after a successful login', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const attempt = (password) => ctx.service.login({ email: user.email, password });

  for (let i = 0; i < 3; i++) {
    await rejectsWith(attempt(WRONG_PASSWORD), 401, AuthErrorCode.INVALID_CREDENTIALS);
  }

  const locked = await attempt(PASSWORD).catch((err) => err);
  assert.equal(locked.status, 429);
  assert.equal(locked.code, AuthErrorCode.TOO_MANY_ATTEMPTS);
  assert.equal(locked.retryAfterSeconds, 60);

  ctx.clock.advance(60_000);
  await attempt(PASSWORD);

  const stored = await ctx.usersRepository.findById(user.id);
  assert.equal(stored.failedLoginCount, 0);
  assert.equal(stored.lockedUntil, null);
});

/**
 * Unit test: the wait grows on each new failure (1 min -> 5 min -> 30 min).
 */
test('login increases the wait on each further failure', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const attempt = (password) => ctx.service.login({ email: user.email, password });

  for (let i = 0; i < 3; i++) await assert.rejects(attempt(WRONG_PASSWORD));
  ctx.clock.advance(60_000);

  await rejectsWith(attempt(WRONG_PASSWORD), 401, AuthErrorCode.INVALID_CREDENTIALS); // 4th
  assert.equal((await attempt(PASSWORD).catch((err) => err)).retryAfterSeconds, 300);

  ctx.clock.advance(300_000);
  await assert.rejects(attempt(WRONG_PASSWORD)); // 5th
  assert.equal((await attempt(PASSWORD).catch((err) => err)).retryAfterSeconds, 1800);
});

/**
 * Unit test: non-enumeration in the wait.
 * Non-existent emails also enter the wait, with the same 429.
 */
test('login applies the same lockout to unknown emails', async () => {
  const ctx = createAuthTestContext();
  const attempt = () => ctx.service.login({ email: 'ghost@laprizza.pt', password: WRONG_PASSWORD });

  for (let i = 0; i < 3; i++) await rejectsWith(attempt(), 401, AuthErrorCode.INVALID_CREDENTIALS);

  const locked = await attempt().catch((err) => err);
  assert.equal(locked.status, 429);
  assert.equal(locked.code, AuthErrorCode.TOO_MANY_ATTEMPTS);
  assert.equal(locked.retryAfterSeconds, 60);

  // The unknown email is never stored in plain text.
  const [entry] = ctx.loginThrottleRepository._getEntries();
  assert.notEqual(entry.keyHash, 'ghost@laprizza.pt');
});

/**
 * Unit test: inactive/disabled account.
 * With the correct password: 403 with its own code and no session; with the wrong one: 401 (the state is not revealed).
 */
test('login rejects inactive and disabled accounts only after a correct password', async () => {
  const ctx = createAuthTestContext();
  const inactive = await ctx.createUser({ email: 'inactive@laprizza.pt', status: 'inactive' });
  const disabled = await ctx.createUser({ email: 'disabled@laprizza.pt', status: 'disabled' });

  await rejectsWith(
    ctx.service.login({ email: inactive.email, password: PASSWORD }),
    403,
    AuthErrorCode.ACCOUNT_INACTIVE,
  );
  await rejectsWith(
    ctx.service.login({ email: disabled.email, password: PASSWORD }),
    403,
    AuthErrorCode.ACCOUNT_DISABLED,
  );
  await rejectsWith(
    ctx.service.login({ email: disabled.email, password: WRONG_PASSWORD }),
    401,
    AuthErrorCode.INVALID_CREDENTIALS,
  );
  assert.equal(ctx.sessionsRepository._getSessions().length, 0);
});

/**
 * Unit test (AA02 extension point): establishSession can be called directly
 * by another authentication method and uses loadRoles.
 */
test('establishSession is reusable and loads roles through the extension point', async () => {
  const ctx = createAuthTestContext({ loadRoles: async () => ['CUSTOMER', 'BETA'] });
  const user = await ctx.createUser();
  const stored = await ctx.usersRepository.findById(user.id);

  const result = await ctx.service.establishSession(stored, { method: 'oidc', ip: '10.0.0.1' });

  assert.deepEqual(result.user.roles, ['CUSTOMER', 'BETA']);
  const event = ctx.securityLogger.events.find((e) => e.event === 'LOGIN_SUCCEEDED');
  assert.equal(event.method, 'oidc');
});

/* ===================================================================== */
/* authenticateAccessToken (used by the middleware)                     */
/* ===================================================================== */

/** Creates a user, logs in and returns the context and the login result. */
async function loggedIn(options) {
  const ctx = createAuthTestContext(options);
  const user = await ctx.createUser();
  const result = await ctx.service.login({ email: user.email, password: PASSWORD });
  return { ctx, user, result };
}

/**
 * Unit test: a valid token returns the user with the role read from the database.
 */
test('authenticateAccessToken returns the current role from the database', async () => {
  const { ctx, user, result } = await loggedIn();

  const auth = await ctx.service.authenticateAccessToken(result.accessToken);
  assert.equal(auth.userId, String(user.id));
  assert.equal(auth.role, 'EMPLOYEE');
  assert.equal(auth.sessionId, String(ctx.sessionsRepository._getSessions()[0]._id));

  await ctx.usersRepository.update(user.id, { role: 'MANAGER' });
  assert.equal((await ctx.service.authenticateAccessToken(result.accessToken)).role, 'MANAGER');
});

/**
 * Unit test: expired token -> TOKEN_EXPIRED; tampered token -> TOKEN_INVALID.
 */
test('authenticateAccessToken distinguishes expired and invalid tokens', async () => {
  const { ctx, result } = await loggedIn({ accessTokenTtlSeconds: -1 });
  await rejectsWith(ctx.service.authenticateAccessToken(result.accessToken), 401, AuthErrorCode.TOKEN_EXPIRED);
  await rejectsWith(ctx.service.authenticateAccessToken('abc.def.ghi'), 401, AuthErrorCode.TOKEN_INVALID);
});

/**
 * Unit test: the token stops working when the account is disabled, when tokenVersion changes
 * or when the session expires.
 */
test('authenticateAccessToken rejects tokens of disabled users, old token versions and expired sessions', async () => {
  const disabledCase = await loggedIn();
  await disabledCase.ctx.usersRepository.update(disabledCase.user.id, { status: 'disabled' });
  await rejectsWith(
    disabledCase.ctx.service.authenticateAccessToken(disabledCase.result.accessToken),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );

  const versionCase = await loggedIn();
  await versionCase.ctx.usersRepository.incrementTokenVersion(versionCase.user.id);
  await rejectsWith(
    versionCase.ctx.service.authenticateAccessToken(versionCase.result.accessToken),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );

  const expiredCase = await loggedIn();
  expiredCase.ctx.clock.advance(TEST_AUTH_CONFIG.refreshTokenTtlMs + 1);
  await rejectsWith(
    expiredCase.ctx.service.authenticateAccessToken(expiredCase.result.accessToken),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );
});

/* ===================================================================== */
/* refresh                                                               */
/* ===================================================================== */

/**
 * Unit test: refresh rotates the token, keeps the session and issues a valid access token.
 */
test('refresh rotates the refresh token and issues a working access token', async () => {
  const { ctx, result } = await loggedIn();

  const refreshed = await ctx.service.refresh(result.refreshToken, REQUEST);

  assert.notEqual(refreshed.refreshToken, result.refreshToken);
  const [session] = ctx.sessionsRepository._getSessions();
  assert.equal(session.refreshTokenHash, ctx.tokenService.hashOpaqueToken(refreshed.refreshToken));
  assert.deepEqual(session.rotatedHashes, [ctx.tokenService.hashOpaqueToken(result.refreshToken)]);
  // Absolute expiry: refresh does not extend the session.
  assert.equal(refreshed.refreshTokenExpiresAt.getTime(), session.expiresAt.getTime());
  await ctx.service.authenticateAccessToken(refreshed.accessToken);
});

/**
 * Unit test: theft detection.
 * Reusing a rotated refresh token revokes the whole session (including the new token).
 */
test('refresh revokes the session when a rotated token is reused', async () => {
  const { ctx, result } = await loggedIn();
  const refreshed = await ctx.service.refresh(result.refreshToken);

  await rejectsWith(ctx.service.refresh(result.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);

  assert.ok(ctx.sessionsRepository._getSessions()[0].revokedAt);
  assert.ok(ctx.securityLogger.events.some((e) => e.event === 'REFRESH_TOKEN_REUSE'));
  await rejectsWith(ctx.service.refresh(refreshed.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
  await rejectsWith(
    ctx.service.authenticateAccessToken(refreshed.accessToken),
    401,
    AuthErrorCode.SESSION_REVOKED,
  );
});

/**
 * Unit test: missing, unknown or expired refresh token -> REFRESH_INVALID.
 */
test('refresh rejects missing, unknown and expired tokens', async () => {
  const { ctx, result } = await loggedIn();

  await rejectsWith(ctx.service.refresh(undefined), 401, AuthErrorCode.REFRESH_INVALID);
  await rejectsWith(
    ctx.service.refresh(ctx.tokenService.generateOpaqueToken()),
    401,
    AuthErrorCode.REFRESH_INVALID,
  );

  ctx.clock.advance(TEST_AUTH_CONFIG.refreshTokenTtlMs + 1);
  await rejectsWith(ctx.service.refresh(result.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
});

/**
 * Unit test: refresh of a session whose user was disabled -> SESSION_REVOKED and the session is revoked.
 */
test('refresh rejects sessions of disabled users', async () => {
  const { ctx, user, result } = await loggedIn();
  await ctx.usersRepository.update(user.id, { status: 'disabled' });

  await rejectsWith(ctx.service.refresh(result.refreshToken), 401, AuthErrorCode.SESSION_REVOKED);
  assert.ok(ctx.sessionsRepository._getSessions()[0].revokedAt);
});

/* ===================================================================== */
/* logout / logoutAll                                                    */
/* ===================================================================== */

/**
 * Unit test: logout ends only the current session; the others stay valid.
 */
test('logout revokes only the current session', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const sessionA = await ctx.service.login({ email: user.email, password: PASSWORD });
  const sessionB = await ctx.service.login({ email: user.email, password: PASSWORD });

  const authA = await ctx.service.authenticateAccessToken(sessionA.accessToken);
  await ctx.service.logout(authA);

  await rejectsWith(ctx.service.authenticateAccessToken(sessionA.accessToken), 401, AuthErrorCode.SESSION_REVOKED);
  await rejectsWith(ctx.service.refresh(sessionA.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
  await ctx.service.authenticateAccessToken(sessionB.accessToken);
});

/**
 * Unit test: logoutAll ends every session and increments tokenVersion.
 */
test('logoutAll revokes every session and increments tokenVersion', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const sessionA = await ctx.service.login({ email: user.email, password: PASSWORD });
  const sessionB = await ctx.service.login({ email: user.email, password: PASSWORD });

  await ctx.service.logoutAll(await ctx.service.authenticateAccessToken(sessionA.accessToken));

  assert.equal((await ctx.usersRepository.findById(user.id)).tokenVersion, 1);
  for (const session of [sessionA, sessionB]) {
    await rejectsWith(ctx.service.authenticateAccessToken(session.accessToken), 401, AuthErrorCode.SESSION_REVOKED);
    await rejectsWith(ctx.service.refresh(session.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
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
  const user = await ctx.createUser();

  const returned = ctx.service.requestPasswordReset({ email: user.email }, REQUEST);
  assert.equal(returned, undefined); // nothing that depends on the account is returned
  await ctx.flushDeferred();

  assert.equal(ctx.emailService.sent.length, 1);
  const email = ctx.emailService.sent[0];
  assert.equal(email.to, user.email);
  assert.ok(email.text.includes(`${TEST_AUTH_CONFIG.passwordResetUrl}#token=`));
  assert.ok(email.text.includes('30 minutos'));
  assert.ok(!email.text.includes('${'));

  const token = tokenFromLastEmail(ctx.emailService);
  const [record] = ctx.resetTokensRepository._getTokens();
  assert.equal(record.tokenHash, ctx.tokenService.hashOpaqueToken(token));
  assert.notEqual(record.tokenHash, token);
  assert.equal(record.expiresAt.getTime(), ctx.clock.now().getTime() + TEST_AUTH_CONFIG.passwordResetTtlMs);
});

/**
 * Unit test: unknown, inactive or disabled accounts do not receive an email (and nothing fails).
 */
test('requestPasswordReset sends nothing for unknown, inactive or disabled accounts', async () => {
  const ctx = createAuthTestContext();
  const inactive = await ctx.createUser({ email: 'inactive@laprizza.pt', status: 'inactive' });
  const disabled = await ctx.createUser({ email: 'disabled@laprizza.pt', status: 'disabled' });

  for (const email of ['ghost@laprizza.pt', inactive.email, disabled.email]) {
    ctx.service.requestPasswordReset({ email });
    await ctx.flushDeferred();
  }

  assert.equal(ctx.emailService.sent.length, 0);
  assert.equal(ctx.resetTokensRepository._getTokens().length, 0);
});

/**
 * Unit test: email errors do not propagate (the response is already 202) and are logged.
 */
test('requestPasswordReset logs email failures instead of throwing', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  ctx.emailService.send = async () => {
    throw new Error('SMTP unavailable');
  };

  ctx.service.requestPasswordReset({ email: user.email });
  await ctx.flushDeferred();

  assert.ok(ctx.securityLogger.events.some((e) => e.event === 'PASSWORD_RESET_ERROR'));
});

/**
 * Unit test: successful reset.
 * New password works, old one does not, tokenVersion increments and every session ends.
 */
test('resetPassword changes the password and revokes every session', async () => {
  const { ctx, user, result } = await loggedIn();
  ctx.service.requestPasswordReset({ email: user.email });
  await ctx.flushDeferred();

  await ctx.service.resetPassword({ token: tokenFromLastEmail(ctx.emailService), newPassword: NEW_PASSWORD });

  assert.equal((await ctx.usersRepository.findById(user.id)).tokenVersion, 1);
  await rejectsWith(ctx.service.authenticateAccessToken(result.accessToken), 401, AuthErrorCode.SESSION_REVOKED);
  await rejectsWith(ctx.service.refresh(result.refreshToken), 401, AuthErrorCode.REFRESH_INVALID);
  await rejectsWith(
    ctx.service.login({ email: user.email, password: PASSWORD }),
    401,
    AuthErrorCode.INVALID_CREDENTIALS,
  );
  await ctx.service.login({ email: user.email, password: NEW_PASSWORD });
});

/**
 * Unit test: single use, expiry and invalidation of previous tokens.
 */
test('resetPassword tokens are single-use, expire after 30 minutes and are replaced by new requests', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const request = async () => {
    ctx.service.requestPasswordReset({ email: user.email });
    await ctx.flushDeferred();
    return tokenFromLastEmail(ctx.emailService);
  };

  // Single use
  const used = await request();
  await ctx.service.resetPassword({ token: used, newPassword: NEW_PASSWORD });
  await rejectsWith(
    ctx.service.resetPassword({ token: used, newPassword: NEW_PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );

  // A new request invalidates the previous one
  const first = await request();
  const second = await request();
  await rejectsWith(
    ctx.service.resetPassword({ token: first, newPassword: PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );

  // Expiry (30 min)
  ctx.clock.advance(TEST_AUTH_CONFIG.passwordResetTtlMs + 1);
  await rejectsWith(
    ctx.service.resetPassword({ token: second, newPassword: PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );
});

/**
 * Unit test: a password that breaks the policy does not consume the token.
 */
test('resetPassword validates the policy before consuming the token', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  ctx.service.requestPasswordReset({ email: user.email });
  await ctx.flushDeferred();
  const token = tokenFromLastEmail(ctx.emailService);

  await rejectsWith(
    ctx.service.resetPassword({ token, newPassword: 'fraca' }),
    400,
    AuthErrorCode.PASSWORD_POLICY_VIOLATION,
  );
  await ctx.service.resetPassword({ token, newPassword: NEW_PASSWORD });
});

/**
 * Unit test: the account was disabled after the request -> the token does not work.
 */
test('resetPassword rejects tokens of accounts that are no longer active', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  ctx.service.requestPasswordReset({ email: user.email });
  await ctx.flushDeferred();
  await ctx.usersRepository.update(user.id, { status: 'disabled' });

  await rejectsWith(
    ctx.service.resetPassword({ token: tokenFromLastEmail(ctx.emailService), newPassword: NEW_PASSWORD }),
    400,
    AuthErrorCode.RESET_TOKEN_INVALID,
  );
});

/* ===================================================================== */
/* changePassword                                                        */
/* ===================================================================== */

/**
 * Unit test: requires the current password and validates the policy of the new one.
 */
test('changePassword requires the current password and enforces the policy', async () => {
  const { ctx, user, result } = await loggedIn();
  const auth = await ctx.service.authenticateAccessToken(result.accessToken);

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
  await ctx.service.login({ email: user.email, password: PASSWORD });
});

/**
 * Unit test: successful change keeps the current session and revokes the others.
 */
test('changePassword keeps the current session and revokes the others', async () => {
  const ctx = createAuthTestContext();
  const user = await ctx.createUser();
  const current = await ctx.service.login({ email: user.email, password: PASSWORD });
  const other = await ctx.service.login({ email: user.email, password: PASSWORD });
  const auth = await ctx.service.authenticateAccessToken(current.accessToken);

  await ctx.service.changePassword({ ...auth, currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

  await ctx.service.authenticateAccessToken(current.accessToken);
  await rejectsWith(ctx.service.authenticateAccessToken(other.accessToken), 401, AuthErrorCode.SESSION_REVOKED);
  await ctx.service.login({ email: user.email, password: NEW_PASSWORD });
});
