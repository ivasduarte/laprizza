import * as defaultUsersRepository from '../../infrastructure/users/users.repository.js';
import * as defaultSessionsRepository from '../../infrastructure/auth/auth-sessions.repository.js';
import * as defaultResetTokensRepository from '../../infrastructure/auth/password-reset-tokens.repository.js';
import * as defaultLoginThrottleRepository from '../../infrastructure/auth/login-throttle.repository.js';
import * as defaultExternalIdentitiesRepository from '../../infrastructure/auth/external-identities.repository.js';
import { passwordHasher as defaultPasswordHasher } from '../../infrastructure/security/password-hasher.js';
import { createTokenService } from '../../infrastructure/security/token-service.js';
import { createEmailService } from '../../infrastructure/email/email.service.js';
import { createSecurityLogger } from '../../infrastructure/logging/security-logger.js';
import { systemClock } from '../../infrastructure/clock.js';
import { createAuthService } from '../../application/auth/auth.service.js';
import { createAuthenticate } from '../middleware/auth.middleware.js';
import { createOidcClient } from '../../infrastructure/oidc/oidc-client.js';
import { createExternalAuthService } from '../../application/auth/external-auth.service.js';
import * as defaultInvitationsRepository from '../../infrastructure/auth/activation-invitations.repository.js';
import * as defaultRoleChangesRepository from '../../infrastructure/users/role-changes.repository.js';
import { createActivationInvitationService } from '../../application/users/activation-invitation.service.js';
import { createRoleChangeRecorder } from '../../application/users/role-change-recorder.js';
import { createUsersService } from '../../application/users/users.service.js';

export function createAuthModule(config, repos = {}) {
  const securityLogger =
    repos.securityLogger ?? createSecurityLogger({ enabled: config.nodeEnv !== 'test' });
  const usersRepository = repos.usersRepository ?? defaultUsersRepository;
  const passwordHasher = repos.passwordHasher ?? defaultPasswordHasher;
  const tokenService = createTokenService({
    jwtSecret: config.jwtSecret,
    accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
  });
  const emailService = repos.emailService ?? createEmailService(config.mail);
  const clock = repos.clock ?? systemClock;

  const authService = createAuthService({
    usersRepository,
    sessionsRepository: repos.sessionsRepository ?? defaultSessionsRepository,
    resetTokensRepository: repos.resetTokensRepository ?? defaultResetTokensRepository,
    loginThrottleRepository: repos.loginThrottleRepository ?? defaultLoginThrottleRepository,
    passwordHasher,
    tokenService,
    emailService,
    securityLogger,
    clock,
    config: config.auth,
  });

  // AA06: activation invitations and role change records, shared by local and external accounts.
  const invitationService = createActivationInvitationService({
    invitationsRepository: repos.invitationsRepository ?? defaultInvitationsRepository,
    tokenService,
    emailService,
    clock,
    securityLogger,
    config: config.invitations,
  });
  const roleChangeRecorder = createRoleChangeRecorder({
    roleChangesRepository: repos.roleChangesRepository ?? defaultRoleChangesRepository,
    clock,
  });
  const usersService = createUsersService({
    usersRepository,
    roleChangeRecorder,
    invitationService,
    securityLogger,
    passwordHasher,
  });

  const externalAuthService = config.external.enabled
    ? createExternalAuthService({
        usersRepository,
        externalIdentitiesRepository:
          repos.externalIdentitiesRepository ?? defaultExternalIdentitiesRepository,
        oidcClient: repos.oidcClient ?? createOidcClient(),
        authService,
        roleChangeRecorder,
        invitationService,
        securityLogger,
        config: config.external,
      })
    : null;
  return {
    authService,
    externalAuthService,
    usersService,
    securityLogger,
    config,
    authenticate: createAuthenticate({ authService, securityLogger }),
  };
}
