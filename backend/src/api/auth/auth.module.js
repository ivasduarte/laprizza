import * as defaultUsersRepository from '../../infrastructure/users/users.repository.js';
import * as defaultSessionsRepository from '../../infrastructure/auth/auth-sessions.repository.js';
import * as defaultResetTokensRepository from '../../infrastructure/auth/password-reset-tokens.repository.js';
import * as defaultLoginThrottleRepository from '../../infrastructure/auth/login-throttle.repository.js';
import { passwordHasher as defaultPasswordHasher } from '../../infrastructure/security/password-hasher.js';
import { createTokenService } from '../../infrastructure/security/token-service.js';
import { createEmailService } from '../../infrastructure/email/email.service.js';
import { createSecurityLogger } from '../../infrastructure/logging/security-logger.js';
import { systemClock } from '../../infrastructure/clock.js';
import { createAuthService } from '../../application/auth/auth.service.js';
import { createAuthenticate } from '../middleware/auth.middleware.js';

export function createAuthModule(config, repos = {}) {
  const securityLogger =
    repos.securityLogger ?? createSecurityLogger({ enabled: config.nodeEnv !== 'test' });

  const authService = createAuthService({
    usersRepository: repos.usersRepository ?? defaultUsersRepository,
    sessionsRepository: repos.sessionsRepository ?? defaultSessionsRepository,
    resetTokensRepository: repos.resetTokensRepository ?? defaultResetTokensRepository,
    loginThrottleRepository: repos.loginThrottleRepository ?? defaultLoginThrottleRepository,
    passwordHasher: repos.passwordHasher ?? defaultPasswordHasher,
    tokenService: createTokenService({
      jwtSecret: config.jwtSecret,
      accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    }),
    emailService: repos.emailService ?? createEmailService(config.mail),
    securityLogger,
    clock: repos.clock ?? systemClock,
    config: config.auth,
  });

  return {
    authService,
    securityLogger,
    config,
    authenticate: createAuthenticate({ authService, securityLogger }),
  };
}
