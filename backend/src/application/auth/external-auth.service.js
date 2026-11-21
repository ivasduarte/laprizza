import { AppError } from '../app-error.js';
import { AccountStatus, withInitialCustomerRole } from '../../domain/users/users.domain.js';
import {
  createExternalIdentity,
  extractIdentityClaims,
  resolveExternalLogin,
  ExternalLoginDecision,
} from '../../domain/auth/external-identity.domain.js';
import { SystemProcess, systemActor } from '../../domain/users/role-changes.domain.js';

export const ExternalAuthCode = Object.freeze({
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  AUTH_FAILED: 'AUTH_FAILED',
});

export const ExternalLoginOutcome = Object.freeze({
  SESSION: 'SESSION',
  ACTIVATED: 'ACTIVATED',
});

/** Why the OIDC transaction was started: a normal login or an account activation (AA07). */
export const ExternalFlowPurpose = Object.freeze({
  LOGIN: 'login',
  ACTIVATION: 'activation',
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
 * @param {{recordInitialRoles: Function}} deps.roleChangeRecorder - AA06 role change records.
 * @param {{prepareExternal: Function, completeExternal: Function}} [deps.activationService] -
 *   AA07 account activation.
 * @param {{log: Function}} deps.securityLogger
 * @param {{providers: Record<string, object>}} deps.config - config.external.
 * @param {{now: () => Date}} [deps.clock]
 */
export function createExternalAuthService({
  usersRepository,
  externalIdentitiesRepository,
  oidcClient,
  authService,
  roleChangeRecorder,
  activationService,
  securityLogger,
  config,
  clock = { now: () => new Date() },
}) {
  /**
   * AA06: the automatic CUSTOMER role is recorded as a system process. A failure here never
   * blocks the login: it is logged for the Administrator.
   */
  async function recordInitialRoles(user) {
    try {
      await roleChangeRecorder.recordInitialRoles(
        user,
        systemActor(SystemProcess.EXTERNAL_FIRST_LOGIN),
      );
    } catch (err) {
      securityLogger.log('ROLE_CHANGE_RECORD_FAILED', {
        userId: String(user._id),
        operation: 'external-first-login',
        roles: user.roles,
        reason: err?.name ?? 'Error',
      });
    }
  }

  /**
   * AA07: an external account is validated by a successful login at its provider. Accounts left
   * waiting for activation by the previous flow (never activated) are activated here; an account
   * deactivated or disabled after its activation is never reactivated (AA03).
   */
  async function activateIfPending(user, provider, context) {
    if (user.status !== AccountStatus.INACTIVE || user.activatedAt) return user;
    const activated = await usersRepository.activateAccount(user._id, { activatedAt: clock.now() });
    if (!activated) return user; // changed meanwhile: establishSession applies the current state
    securityLogger.log('ACCOUNT_ACTIVATED', {
      userId: String(user._id),
      method: 'external',
      provider: provider.name,
      ip: context.ip,
    });
    return activated;
  }

  /**
   * AA02: account + identity link for a new verified identity. The two writes are not atomic,
   * so the account is removed if the link fails; otherwise the e-mail would stay taken by an
   * account no provider can sign in to (every later attempt: ACCOUNT_LINK_REQUIRED).
   */
  async function createLinkedAccount(email, identity, provider, context) {
    let user;
    try {
      user = await usersRepository.create({
        email,
        roles: withInitialCustomerRole(), // roles from the IdP are never used
        // AA02/AA07: the verified provider identity validates the account.
        status: AccountStatus.ACTIVE,
        activatedAt: clock.now(),
      });
    } catch (err) {
      if (err?.code === 11000) throw deny(provider, context, 'ACCOUNT_LINK_REQUIRED', 403);
      throw err;
    }
    try {
      await externalIdentitiesRepository.create({ userId: user._id, ...identity });
    } catch (err) {
      await usersRepository.deleteById(user._id);
      // Same identity linked by a concurrent first login: that request owns the account.
      if (err?.code === 11000) throw deny(provider, context, ExternalAuthCode.AUTH_FAILED, 409);
      throw err;
    }
    return user;
  }

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
     * AA07: starts the activation of an external account. The invitation decides the provider
     * (the one linked to the account); the transaction keeps the hash of the invitation token,
     * never the token, and is marked as an activation so the callback cannot create accounts
     * or open a session with it.
     *
     * @param {{token: string}} input
     * @throws {AppError} 400 INVITATION_INVALID, 404 PROVIDER_NOT_FOUND.
     */
    async startActivation({ token }, context = {}) {
      const { provider: providerName, invitationHash } = await activationService.prepareExternal(
        { token },
        context,
      );
      const provider = providerOf(providerName);
      const { authorizationUrl, transaction } = await oidcClient.createAuthorizationRequest(provider);
      return {
        authorizationUrl,
        transaction: {
          ...transaction,
          provider: provider.name,
          purpose: ExternalFlowPurpose.ACTIVATION,
          invitationHash,
        },
      };
    },

    /**
     * Completes the login after the IdP redirect.
     * - Linked identity: creates a session through authService.establishSession
     *   (inactive/disabled accounts are refused there).
     * - Unknown identity with a verified, unused e-mail: creates an ACTIVE account with the
     *   CUSTOMER role and opens the session (AA02). The contact phone is asked next
     *   (session user `phoneRequired`).
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

      // AA07: an activation never creates an account nor opens a session.
      if (transaction?.purpose === ExternalFlowPurpose.ACTIVATION) {
        await activationService.completeExternal(
          { invitationHash: transaction.invitationHash, identity },
          { ...context, provider: provider.name },
        );
        return { outcome: ExternalLoginOutcome.ACTIVATED };
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
        let user = await usersRepository.findById(linked.userId);
        if (!user) throw deny(provider, context, ExternalAuthCode.AUTH_FAILED, 401);
        user = await activateIfPending(user, provider, context);
        const session = await authService.establishSession(user, { ...context, method: 'oidc' });
        return { outcome: ExternalLoginOutcome.SESSION, session };
      }

      // CREATE_ACCOUNT: Customer role is automatic (AA03); the account is active (AA02).
      const user = await createLinkedAccount(email, identity, provider, context);
      securityLogger.log('EXTERNAL_ACCOUNT_CREATED', {
        provider: provider.name,
        userId: String(user._id),
        ip: context.ip,
      });
      await recordInitialRoles(user);
      const session = await authService.establishSession(user, { ...context, method: 'oidc' });
      return { outcome: ExternalLoginOutcome.SESSION, session };
    },
  };
}
