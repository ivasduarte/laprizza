import * as defaultUsersRepository from '../../infrastructure/users/users.repository.js';
import { passwordHasher as defaultPasswordHasher } from '../../infrastructure/security/password-hasher.js';
import { Roles, AccountStatus, normalizeEmail } from '../../domain/users/users.domain.js';
import {
  evaluateAuthentication,
  computeLockoutDelayMs,
  remainingLockoutMs,
  isSessionUsable,
} from '../../domain/auth/auth.domain.js';
import { AppError } from '../app-error.js';
import { AuthErrorCode, authError, tooManyAttempts } from './auth-errors.js';
import { assertPasswordPolicy } from './password-policy.js';
import { buildPasswordResetEmail } from './password-reset-email.js';
import { toUserDto } from '../users/users.service.js';

/**
 * Registers a user (Manager, Sprint 1). Email is mandatory: it is the login identifier.
 * Accounts created this way are ACTIVE; AA06 will create INACTIVE accounts with an invitation.
 *
 * @param {Object} userData
 * @param {Object} [usersRepository=defaultUsersRepository]
 * @param {Object} [passwordHasher=defaultPasswordHasher]
 * @returns {Promise<Object>} The created user DTO.
 * @throws {AppError} 400 (invalid data/policy) or 409 (duplicate email/username).
 */
export async function registerUser(
  { username, email, password, role, customerId },
  usersRepository = defaultUsersRepository,
  passwordHasher = defaultPasswordHasher,
) {
  if (customerId && role !== Roles.CUSTOMER) {
    throw new AppError('Only users with the CUSTOMER role can have an associated customerId.', 400);
  }
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new AppError('Email is mandatory.', 400);

  assertPasswordPolicy(password);
  const passwordHash = await passwordHasher.hash(password);

  try {
    const savedUser = await usersRepository.create({
      username: username?.trim().toLowerCase(),
      email: normalizedEmail,
      passwordHash,
      role,
      customerId,
      status: AccountStatus.ACTIVE,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
    });
    return toUserDto(savedUser);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Email or username already in use.', 409);
    throw err;
  }
}

/** Data of the authenticated user returned to the SPA (no secrets). */
function toAuthenticatedUserDto(user, roles) {
  return {
    id: String(user._id ?? user.id),
    email: user.email,
    role: user.role,
    roles,
    status: user.status,
  };
}

/**
 * Authentication use cases. Every dependency is injected (testable without Mongo/Express).
 *
 * @param {object} deps
 * @param {object} deps.usersRepository
 * @param {object} deps.sessionsRepository
 * @param {object} deps.resetTokensRepository
 * @param {object} deps.loginThrottleRepository
 * @param {object} deps.passwordHasher
 * @param {object} deps.tokenService
 * @param {object} deps.emailService
 * @param {object} deps.securityLogger
 * @param {{now: () => Date}} deps.clock
 * @param {object} deps.config - config.auth (see loadConfig)
 * @param {(user: object) => Promise<string[]>} [deps.loadRoles] - Extension point for AA03.
 * @param {(task: () => void) => void} [deps.defer] - Runs work after the response (forgot).
 */
export function createAuthService({
  usersRepository,
  sessionsRepository,
  resetTokensRepository,
  loginThrottleRepository,
  passwordHasher,
  tokenService,
  emailService,
  securityLogger,
  clock,
  config,
  loadRoles = async (user) => [user.role],
  defer = (task) => setImmediate(task),
}) {
  const lockoutPolicy = { threshold: config.lockoutThreshold, stepsMs: config.lockoutStepsMs };

  async function lockoutRemainingMs(user, throttleKey, now) {
    if (user) return remainingLockoutMs(user.lockedUntil, now);
    const entry = await loginThrottleRepository.findByKey(throttleKey);
    return remainingLockoutMs(entry?.lockedUntil, now);
  }

  /** Same counter/wait logic for existing and non-existing accounts. */
  async function registerFailure(user, throttleKey, now) {
    if (user) {
      const updated = await usersRepository.registerFailedLogin(user._id);
      const delay = computeLockoutDelayMs(updated?.failedLoginCount ?? 0, lockoutPolicy);
      if (delay > 0) await usersRepository.extendLockout(user._id, new Date(now.getTime() + delay));
      return;
    }
    const entry = await loginThrottleRepository.registerFailure(
      throttleKey,
      now,
      config.unknownAccountThrottleRetentionMs,
    );
    const delay = computeLockoutDelayMs(entry?.failedCount ?? 0, lockoutPolicy);
    if (delay > 0) {
      await loginThrottleRepository.extendLockout(throttleKey, new Date(now.getTime() + delay));
    }
  }

  /**
   * Shared entry point for local (AA01) and external (AA02) login:
   * validates the account state, loads roles from the back end, creates the AuthSession and issues the tokens.
   *
   * @param {object} user - User document (already authenticated by the caller).
   * @param {{ip?: string, userAgent?: string, method?: 'local'|'oidc'}} [context]
   */
  async function establishSession(user, context = {}) {
    const decision = evaluateAuthentication(user);
    if (!decision.allowed) {
      securityLogger.log('LOGIN_DENIED', {
        userId: String(user._id),
        ip: context.ip,
        method: context.method,
        reason: decision.reason,
      });
      throw authError(decision.reason, 403);
    }

    const now = clock.now();
    const roles = await loadRoles(user);
    const tokenVersion = user.tokenVersion ?? 0;
    const refreshToken = tokenService.generateOpaqueToken();
    const expiresAt = new Date(now.getTime() + config.refreshTokenTtlMs); // absolute expiry

    const session = await sessionsRepository.create({
      userId: user._id,
      refreshTokenHash: tokenService.hashOpaqueToken(refreshToken),
      tokenVersion,
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      revokedAt: null,
      userAgent: context.userAgent?.slice(0, 256),
      ip: context.ip,
    });

    securityLogger.log('LOGIN_SUCCEEDED', {
      userId: String(user._id),
      sessionId: String(session._id),
      ip: context.ip,
      method: context.method,
    });

    return {
      accessToken: tokenService.signAccessToken({
        userId: user._id,
        sessionId: session._id,
        tokenVersion,
      }),
      expiresIn: tokenService.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: toAuthenticatedUserDto(user, roles),
    };
  }

  /** Local login (email + password). */
  async function login({ email, password }, context = {}) {
    const normalizedEmail = normalizeEmail(email);
    const now = clock.now();
    const throttleKey = tokenService.hashOpaqueToken(normalizedEmail);
    const user = await usersRepository.findByEmailWithPasswordHash(normalizedEmail);

    const waitMs = await lockoutRemainingMs(user, throttleKey, now);
    if (waitMs > 0) {
      securityLogger.log('LOGIN_FAILED', {
        email: normalizedEmail,
        ip: context.ip,
        reason: 'LOCKED_OUT',
      });
      throw tooManyAttempts(AuthErrorCode.TOO_MANY_ATTEMPTS, waitMs);
    }

    const passwordMatches = user
      ? await passwordHasher.verify(user.passwordHash, password)
      : await passwordHasher.verifyDummy(password);

    if (!passwordMatches) {
      await registerFailure(user, throttleKey, now);
      securityLogger.log('LOGIN_FAILED', {
        email: normalizedEmail,
        userId: user ? String(user._id) : undefined,
        ip: context.ip,
        reason: user ? 'INVALID_PASSWORD' : 'UNKNOWN_ACCOUNT',
      });
      throw authError(AuthErrorCode.INVALID_CREDENTIALS, 401);
    }

    // Correct password: reset the wait (even if the account is not active, the password was proven).
    if (user.failedLoginCount > 0 || user.lockedUntil)
      await usersRepository.clearLoginFailures(user._id);
    if (passwordHasher.needsRehash(user.passwordHash)) {
      await usersRepository.setPasswordHash(user._id, await passwordHasher.hash(password));
    }

    return establishSession(user, { ...context, method: 'local' });
  }

  /** Rotates the refresh token and issues a new access token. Detects reuse of rotated tokens. */
  async function refresh(refreshToken, context = {}) {
    if (!refreshToken) throw authError(AuthErrorCode.REFRESH_INVALID, 401);

    const now = clock.now();
    const currentHash = tokenService.hashOpaqueToken(refreshToken);
    const nextToken = tokenService.generateOpaqueToken();
    const session = await sessionsRepository.rotateRefreshToken(
      currentHash,
      tokenService.hashOpaqueToken(nextToken),
      now,
    );

    if (!session) {
      const reused = await sessionsRepository.findByRotatedHash(currentHash);
      if (reused && !reused.revokedAt) {
        await sessionsRepository.revoke(reused._id, now);
        securityLogger.log('REFRESH_TOKEN_REUSE', {
          userId: String(reused.userId),
          sessionId: String(reused._id),
          ip: context.ip,
        });
      } else {
        securityLogger.log('REFRESH_FAILED', {
          ip: context.ip,
          reason: 'UNKNOWN_REVOKED_OR_EXPIRED',
        });
      }
      throw authError(AuthErrorCode.REFRESH_INVALID, 401);
    }

    const user = await usersRepository.findById(session.userId);
    const stillValid =
      user &&
      evaluateAuthentication(user).allowed &&
      (user.tokenVersion ?? 0) === session.tokenVersion;
    if (!stillValid) {
      await sessionsRepository.revoke(session._id, now);
      securityLogger.log('REFRESH_FAILED', {
        userId: String(session.userId),
        ip: context.ip,
        reason: 'SESSION_REVOKED',
      });
      throw authError(AuthErrorCode.SESSION_REVOKED, 401);
    }

    const roles = await loadRoles(user);
    return {
      accessToken: tokenService.signAccessToken({
        userId: user._id,
        sessionId: session._id,
        tokenVersion: session.tokenVersion,
      }),
      expiresIn: tokenService.accessTokenTtlSeconds,
      refreshToken: nextToken,
      refreshTokenExpiresAt: session.expiresAt,
      user: toAuthenticatedUserDto(user, roles),
    };
  }

  /**
   * Validates an access token on each protected request (used by the middleware):
   * signature/expiry, user exists and is active, tv === tokenVersion, sid session usable.
   */
  async function authenticateAccessToken(accessToken) {
    let claims;
    try {
      claims = tokenService.verifyAccessToken(accessToken);
    } catch (err) {
      throw authError(
        err.reason === 'EXPIRED' ? AuthErrorCode.TOKEN_EXPIRED : AuthErrorCode.TOKEN_INVALID,
        401,
      );
    }

    const [user, session] = await Promise.all([
      usersRepository.findById(claims.sub),
      sessionsRepository.findById(claims.sid),
    ]);
    if (!user) throw authError(AuthErrorCode.TOKEN_INVALID, 401);

    const valid =
      evaluateAuthentication(user).allowed &&
      (user.tokenVersion ?? 0) === claims.tv &&
      isSessionUsable(session, clock.now()) &&
      String(session.userId) === String(user._id);
    if (!valid) throw authError(AuthErrorCode.SESSION_REVOKED, 401);

    return {
      userId: String(user._id),
      role: user.role, // from the database, never from the client
      roles: await loadRoles(user),
      sessionId: String(session._id),
    };
  }

  /** Ends only the current session. */
  async function logout({ sessionId, userId }, context = {}) {
    await sessionsRepository.revoke(sessionId, clock.now());
    securityLogger.log('LOGOUT', { userId, sessionId, ip: context.ip });
  }

  /** Ends every session of the user (also invalidates every access token through tokenVersion). */
  async function logoutAll({ userId }, context = {}) {
    await usersRepository.incrementTokenVersion(userId);
    await sessionsRepository.revokeAllForUser(userId, clock.now());
    securityLogger.log('LOGOUT_ALL', { userId, ip: context.ip });
  }

  /**
   * Requests recovery. Returns immediately: all the work (DB + email) runs after the response,
   * so the response time does not depend on the account existing.
   */
  function requestPasswordReset({ email }, context = {}) {
    const normalizedEmail = normalizeEmail(email);
    defer(() =>
      issuePasswordReset(normalizedEmail, context).catch((err) =>
        securityLogger.log('PASSWORD_RESET_ERROR', { ip: context.ip, reason: err.message }),
      ),
    );
  }

  async function issuePasswordReset(normalizedEmail, context) {
    const user = await usersRepository.findByEmail(normalizedEmail);
    // Only active accounts. Inactive accounts use the invitation (AA07); disabled ones cannot recover.
    if (!user || user.status !== AccountStatus.ACTIVE) {
      securityLogger.log('PASSWORD_RESET_IGNORED', {
        email: normalizedEmail,
        ip: context.ip,
        reason: user ? 'ACCOUNT_NOT_ACTIVE' : 'UNKNOWN_ACCOUNT',
      });
      return;
    }

    const now = clock.now();
    const token = tokenService.generateOpaqueToken();
    await resetTokensRepository.invalidateActiveForUser(user._id);
    await resetTokensRepository.create({
      tokenHash: tokenService.hashOpaqueToken(token),
      userId: user._id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + config.passwordResetTtlMs),
      usedAt: null,
    });

    // The token goes in the fragment (#): browsers never send it to the server nor in the Referer.
    const resetUrl = `${config.passwordResetUrl}#token=${token}`;
    await emailService.send({
      to: user.email,
      ...buildPasswordResetEmail({
        resetUrl,
        expiresInMinutes: Math.round(config.passwordResetTtlMs / 60000),
      }),
    });
    securityLogger.log('PASSWORD_RESET_REQUESTED', { userId: String(user._id), ip: context.ip });
  }

  /** Completes the recovery: single-use, time-limited token; revokes every session. */
  async function resetPassword({ token, newPassword }, context = {}) {
    assertPasswordPolicy(newPassword); // before consuming: an invalid password does not burn the link
    const newHash = await passwordHasher.hash(newPassword);
    const now = clock.now();

    const record = await resetTokensRepository.consume(tokenService.hashOpaqueToken(token), now);
    const user = record ? await usersRepository.findById(record.userId) : null;
    if (!user || user.status !== AccountStatus.ACTIVE) {
      securityLogger.log('PASSWORD_RESET_FAILED', {
        ip: context.ip,
        reason: record ? 'ACCOUNT_NOT_ACTIVE' : 'INVALID_TOKEN',
      });
      throw authError(AuthErrorCode.RESET_TOKEN_INVALID, 400);
    }

    await usersRepository.setPasswordHash(user._id, newHash, { revokeTokens: true });
    await sessionsRepository.revokeAllForUser(user._id, now);
    securityLogger.log('PASSWORD_RESET_COMPLETED', { userId: String(user._id), ip: context.ip });
  }

  /**
   * Authenticated password change. Keeps the current session and revokes the others:
   * the middleware checks the session on every request, so the other sessions'
   * access tokens stop working immediately, without having to issue new tokens.
   */
  async function changePassword({ userId, sessionId, currentPassword, newPassword }, context = {}) {
    const user = await usersRepository.findByIdWithPasswordHash(userId);
    if (!user) throw authError(AuthErrorCode.SESSION_REVOKED, 401);

    if (!(await passwordHasher.verify(user.passwordHash, currentPassword))) {
      securityLogger.log('PASSWORD_CHANGE_FAILED', {
        userId,
        ip: context.ip,
        reason: 'CURRENT_PASSWORD_INCORRECT',
      });
      throw authError(AuthErrorCode.CURRENT_PASSWORD_INCORRECT, 400);
    }
    assertPasswordPolicy(newPassword);

    await usersRepository.setPasswordHash(user._id, await passwordHasher.hash(newPassword));
    await sessionsRepository.revokeAllForUser(user._id, clock.now(), {
      exceptSessionId: sessionId,
    });
    securityLogger.log('PASSWORD_CHANGED', { userId, sessionId, ip: context.ip });
  }

  return {
    establishSession,
    login,
    refresh,
    authenticateAccessToken,
    logout,
    logoutAll,
    requestPasswordReset,
    resetPassword,
    changePassword,
  };
}
