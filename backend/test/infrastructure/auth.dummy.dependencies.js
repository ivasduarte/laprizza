import * as argon2 from 'argon2';
import { createPasswordHasher } from '../../src/infrastructure/security/password-hasher.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';
import { createAuthService, registerUser } from '../../src/application/auth/auth.service.js';
import { AccountStatus } from '../../src/domain/users/users.domain.js';
import { createDummyUsersRepository } from './users.dummy.repository.js';
import { createDummyAuthSessionsRepository } from './auth-sessions.dummy.repository.js';
import { createDummyPasswordResetTokensRepository } from './password-reset-tokens.dummy.repository.js';
import { createDummyLoginThrottleRepository } from './login-throttle.dummy.repository.js';

/** Cheap Argon2 parameters: tests stay fast without changing the behaviour. */
export const FAST_ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 1024,
  timeCost: 1,
  parallelism: 1,
});

export const TEST_JWT_SECRET = 'test_secret_key';

/** Same values as the loadConfig() defaults. */
export const TEST_AUTH_CONFIG = Object.freeze({
  accessTokenTtlSeconds: 3600,
  refreshTokenTtlMs: 7 * 86_400_000,
  lockoutThreshold: 3,
  lockoutStepsMs: [60_000, 300_000, 1_800_000],
  unknownAccountThrottleRetentionMs: 86_400_000,
  passwordResetTtlMs: 30 * 60_000,
  passwordResetUrl: 'http://localhost:4200/reset-password',
});

/**
 * Controllable clock: `advance(ms)` simulates the passing of time.
 *
 * @param {Date} [start]
 */
export function createFixedClock(start = new Date('2026-11-02T10:00:00.000Z')) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
  };
}

/** Email service that only records the messages. */
export function createFakeEmailService() {
  const sent = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

/** Security logger that keeps the events in memory. */
export function createFakeSecurityLogger() {
  const events = [];
  return {
    events,
    log(event, details = {}) {
      events.push({ event, ...details });
    },
  };
}

/**
 * In-memory dependencies with the same keys createAuthModule() accepts in `repos`.
 * Usable in service unit tests and in API tests (createApp).
 */
export function createDummyAuthRepositories() {
  return {
    usersRepository: createDummyUsersRepository(),
    sessionsRepository: createDummyAuthSessionsRepository(),
    resetTokensRepository: createDummyPasswordResetTokensRepository(),
    loginThrottleRepository: createDummyLoginThrottleRepository(),
    passwordHasher: createPasswordHasher(FAST_ARGON2_OPTIONS),
    emailService: createFakeEmailService(),
    securityLogger: createFakeSecurityLogger(),
  };
}

/**
 * In-memory auth infrastructure (sessions, reset tokens, throttle, email and logger) for API tests
 * that already create their own users repository. Spread it into the `repos` passed to createApp:
 * `createApp(config, { usersRepository: usersRepo, ...createDummyAuthInfrastructure() })`.
 */
export function createDummyAuthInfrastructure() {
  const repos = createDummyAuthRepositories();
  // Users come from the test's own repository; the default hasher matches registerUser's default.
  return {
    sessionsRepository: repos.sessionsRepository,
    resetTokensRepository: repos.resetTokensRepository,
    loginThrottleRepository: repos.loginThrottleRepository,
    emailService: repos.emailService,
    securityLogger: repos.securityLogger,
  };
}

/**
 * Builds the authentication service with dummy dependencies, a controllable clock
 * and a `defer` that can be awaited (flushDeferred) to test /forgot.
 *
 * @param {object} [options]
 * @param {number} [options.accessTokenTtlSeconds=3600] - Negative values produce already expired tokens.
 * @param {(user: object) => Promise<string[]>} [options.loadRoles]
 */
export function createAuthTestContext({ accessTokenTtlSeconds = 3600, loadRoles } = {}) {
  const repos = createDummyAuthRepositories();
  const clock = createFixedClock();
  const tokenService = createTokenService({ jwtSecret: TEST_JWT_SECRET, accessTokenTtlSeconds });
  let pending = Promise.resolve();

  const service = createAuthService({
    ...repos,
    tokenService,
    clock,
    config: TEST_AUTH_CONFIG,
    ...(loadRoles ? { loadRoles } : {}),
    defer: (task) => {
      pending = task();
    },
  });

  return {
    ...repos,
    clock,
    tokenService,
    service,
    /** Waits for the work scheduled by requestPasswordReset. */
    flushDeferred: () => pending,

    /** Creates a user (ACTIVE by default) and returns it with the plain password. */
    async createUser({
      email = 'user@laprizza.pt',
      password = 'StrongPassword123!',
      role = 'EMPLOYEE',
      status = AccountStatus.ACTIVE,
    } = {}) {
      const dto = await registerUser({ email, password, role }, repos.usersRepository, repos.passwordHasher);
      if (status !== AccountStatus.ACTIVE) await repos.usersRepository.update(dto.id, { status });
      return { ...dto, password };
    },
  };
}
