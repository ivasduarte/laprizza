import { AppError } from '../app-error.js';
import { AccountStatus, Roles } from '../../domain/users/users.domain.js';
import {
  createExternalIdentity,
  extractIdentityClaims,
  resolveExternalLogin,
  ExternalLoginDecision,
} from '../../domain/auth/external-identity.domain.js';

export const ExternalAuthCode = Object.freeze({
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  AUTH_FAILED: 'AUTH_FAILED',
});

export const ExternalLoginOutcome = Object.freeze({
  SESSION: 'SESSION',
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
});

const externalError = (code, status, message) =>
  new AppError(message ?? 'External authentication failed.', status, null, code);

/**
 * External (OIDC) authentication use cases. Every dependency is injected.
 *
 * @param {object} deps
 * @param {object} deps.usersRepository - findByEmail, findById, create.
 * @param {object} deps.externalIdentitiesRepository - findByIssuerAndSubject, create.
 * @param {object} deps.oidcClient - createAuthorizationRequest, completeAuthorization.
 * @param {{establishSession: Function}} deps.authService - shared session creation (AA01/AA04).
 * @param {{log: Function}} deps.securityLogger
 * @param {{providers: Record<string, object>}} deps.config - config.external.
 */
export function createExternalAuthService({
  usersRepository,
  externalIdentitiesRepository,
  oidcClient,
  authService,
  securityLogger,
  config,
}) {
  function providerOf(name) {
    const provider = Object.hasOwn(config.providers, name) ? config.providers[name] : undefined;
    if (!provider) {
      throw externalError(ExternalAuthCode.PROVIDER_NOT_FOUND, 404, 'Unknown authentication provider.');
    }
    return provider;
  }

  const deny = (provider, context, reason, status) => {
    securityLogger.log('EXTERNAL_LOGIN_DENIED', { provider: provider.name, ip: context.ip, reason });
    return externalError(reason, status);
  };

  return {
    /** Providers enabled in this deployment (for the SPA login buttons). */
    listProviders() {
      return Object.values(config.providers).map(({ name, label }) => ({ name, label }));
    },

    /** Starts the login: returns the IdP URL and the transaction to keep in the browser cookie. */
    async startLogin(providerName) {
      const provider = providerOf(providerName);
      const { authorizationUrl, transaction } = await oidcClient.createAuthorizationRequest(provider);
      return { authorizationUrl, transaction: { ...transaction, provider: provider.name } };
    },

    /**
     * Completes the login after the IdP redirect.
     * - Linked identity: creates a session through authService.establishSession
     *   (inactive/disabled accounts are refused there).
     * - Unknown identity with a verified, unused e-mail: creates an INACTIVE account with the
     *   CUSTOMER role and NO session (activation: AA06/AA07).
     *
     * @returns {Promise<{outcome: string, session?: object}>}
     * @throws {AppError} with a stable `code`.
     */
    async completeLogin({ providerName, callbackUrl, transaction }, context = {}) {
      const provider = providerOf(providerName);

      let claims;
      try {
        claims = await oidcClient.completeAuthorization(provider, callbackUrl, transaction);
      } catch (err) {
        securityLogger.log('EXTERNAL_LOGIN_FAILED', {
          provider: provider.name,
          ip: context.ip,
          reason: err?.name, // never the message: it may echo IdP data
        });
        throw externalError(ExternalAuthCode.AUTH_FAILED, 401);
      }

      const { subject, email, emailVerified } = extractIdentityClaims(claims, provider);
      let identity;
      try {
        identity = createExternalIdentity({ provider: provider.name, issuer: claims.iss, subject });
      } catch {
        throw deny(provider, context, ExternalAuthCode.AUTH_FAILED, 401);
      }

      const linked = await externalIdentitiesRepository.findByIssuerAndSubject(
        identity.issuer,
        identity.subject,
      );
      const emailOwner = !linked && email ? await usersRepository.findByEmail(email) : null;

      const result = resolveExternalLogin({
        hasLinkedUser: Boolean(linked),
        email,
        emailVerified,
        emailOwnerExists: Boolean(emailOwner),
      });

      if (result.decision === ExternalLoginDecision.DENY) {
        throw deny(provider, context, result.reason, 403);
      }

      if (result.decision === ExternalLoginDecision.LOGIN) {
        const user = await usersRepository.findById(linked.userId);
        if (!user) throw deny(provider, context, ExternalAuthCode.AUTH_FAILED, 401);
        const session = await authService.establishSession(user, { ...context, method: 'oidc' });
        return { outcome: ExternalLoginOutcome.SESSION, session };
      }

      // CREATE_ACCOUNT: Customer role is automatic (AA03), activation is not (AA06/AA07).
      let user;
      try {
        user = await usersRepository.create({
          email,
          roles: [Roles.CUSTOMER],
          status: AccountStatus.INACTIVE,
        });
      } catch (err) {
        if (err?.code === 11000) throw deny(provider, context, 'ACCOUNT_LINK_REQUIRED', 403);
        throw err;
      }
      await externalIdentitiesRepository.create({ userId: user._id, ...identity });
      securityLogger.log('EXTERNAL_ACCOUNT_CREATED', {
        provider: provider.name,
        userId: String(user._id),
        ip: context.ip,
      });
      return { outcome: ExternalLoginOutcome.PENDING_ACTIVATION };
    },
  };
}
