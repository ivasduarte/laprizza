import {
  ActivationDenial,
  ActivationMethod,
  activationMethodFor,
  evaluateAccountActivation,
  isInvitedIdentity,
  maskEmail,
} from '../../domain/users/account-activation.domain.js';
import { AuthErrorCode, authError } from './auth-errors.js';
import { assertPasswordPolicy } from './password-policy.js';

/**
 * Account activation (AA07): the invited user completes the activation of an inactive account
 * with the single-use invitation issued by AA06.
 * - Local account: the user sets the password; the account becomes active.
 * - External account: the user signs in at the provider linked to the account; the account
 *   becomes active only if the authenticated identity is that one.
 * Activation never opens a session, never changes the roles and never grants consents: the
 * user signs in afterwards through the normal login (AA01/AA02).
 *
 * Every dependency is injected.
 *
 * @param {object} deps
 * @param {object} deps.invitationsRepository - findByTokenHash, consume.
 * @param {object} deps.usersRepository - findById, activateAccount.
 * @param {object} deps.externalIdentitiesRepository - findByUserId.
 * @param {object} deps.passwordHasher - hash.
 * @param {object} deps.tokenService - hashOpaqueToken.
 * @param {{log: Function}} deps.securityLogger
 * @param {{now: () => Date}} deps.clock
 */
export function createAccountActivationService({
  invitationsRepository,
  usersRepository,
  externalIdentitiesRepository,
  passwordHasher,
  tokenService,
  securityLogger,
  clock,
}) {
  /** Logs the real reason and answers with the generic code (no account enumeration). */
  function refuse(reason, context, details = {}) {
    securityLogger.log('ACCOUNT_ACTIVATION_FAILED', { ip: context.ip, reason, ...details });
    return authError(AuthErrorCode.INVITATION_INVALID, 400);
  }

  /**
   * Loads the invitation, its account and the account's external identities, and checks that
   * the invitation can activate that account now. Nothing is changed.
   */
  async function loadPending(tokenHash, now, context) {
    const invitation = await invitationsRepository.findByTokenHash(tokenHash);
    const user = invitation ? await usersRepository.findById(invitation.userId) : null;
    const decision = evaluateAccountActivation({ invitation, user, now });
    if (!decision.allowed) {
      throw refuse(
        decision.reason,
        context,
        invitation ? { userId: String(invitation.userId) } : {},
      );
    }
    const identities = (await externalIdentitiesRepository.findByUserId(user._id)) ?? [];
    return { invitation, user, identities, ...activationMethodFor(identities) };
  }

  /** Uses the invitation and activates the account. Both steps are conditional (atomic). */
  async function consumeAndActivate({ tokenHash, user, method, passwordHash }, context, now) {
    const used = await invitationsRepository.consume(tokenHash, now);
    if (!used) {
      // Another request used or replaced it between the check and now.
      throw refuse(ActivationDenial.INVITATION_USED, context, { userId: String(user._id) });
    }
    const activated = await usersRepository.activateAccount(user._id, {
      activatedAt: now,
      ...(passwordHash ? { passwordHash } : {}),
    });
    if (!activated) {
      // Disabled (or activated) by an Administrator in the meantime: the link is spent anyway.
      throw refuse(ActivationDenial.ACCOUNT_NOT_PENDING, context, { userId: String(user._id) });
    }
    securityLogger.log('ACCOUNT_ACTIVATED', {
      userId: String(user._id),
      method,
      ip: context.ip,
    });
  }

  return {
    /**
     * Checks an activation link before the user acts, so the page can show the right step.
     * Uses nothing up: the invitation stays valid.
     *
     * @param {{token: string}} input
     * @returns {Promise<{method: string, provider?: string, email: string, expiresAt: Date}>}
     *   `email` is masked.
     * @throws {AppError} 400 INVITATION_INVALID.
     */
    async inspect({ token }, context = {}) {
      const pending = await loadPending(tokenService.hashOpaqueToken(token), clock.now(), context);
      return {
        method: pending.method,
        ...(pending.provider ? { provider: pending.provider } : {}),
        email: maskEmail(pending.user.email),
        expiresAt: new Date(pending.invitation.expiresAt),
      };
    },

    /**
     * Local activation: sets the password chosen by the user and activates the account.
     * The password policy is checked before the link is used, so a weak password does not
     * spend the invitation.
     *
     * @param {{token: string, newPassword: string}} input
     * @throws {AppError} 400 PASSWORD_POLICY_VIOLATION or INVITATION_INVALID.
     */
    async activateLocal({ token, newPassword }, context = {}) {
      assertPasswordPolicy(newPassword);
      const passwordHash = await passwordHasher.hash(newPassword);

      const now = clock.now();
      const tokenHash = tokenService.hashOpaqueToken(token);
      const pending = await loadPending(tokenHash, now, context);
      if (pending.method !== ActivationMethod.LOCAL) {
        throw refuse(ActivationDenial.METHOD_MISMATCH, context, {
          userId: String(pending.user._id),
        });
      }
      await consumeAndActivate(
        { tokenHash, user: pending.user, method: ActivationMethod.LOCAL, passwordHash },
        context,
        now,
      );
    },

    /**
     * External activation, step 1: checks the link and tells which provider must be used.
     * The token hash is what the OIDC transaction keeps (never the token itself).
     *
     * @param {{token: string}} input
     * @returns {Promise<{provider: string, invitationHash: string}>}
     * @throws {AppError} 400 INVITATION_INVALID (also for a local account).
     */
    async prepareExternal({ token }, context = {}) {
      const tokenHash = tokenService.hashOpaqueToken(token);
      const pending = await loadPending(tokenHash, clock.now(), context);
      if (pending.method !== ActivationMethod.EXTERNAL) {
        throw refuse(ActivationDenial.METHOD_MISMATCH, context, {
          userId: String(pending.user._id),
        });
      }
      return { provider: pending.provider, invitationHash: tokenHash };
    },

    /**
     * External activation, step 2 (after the provider redirect): the identity authenticated
     * at the provider must be the one linked to the invited account. A different identity
     * leaves the invitation unused and the account inactive.
     *
     * @param {{invitationHash: string, identity: {issuer: string, subject: string}}} input
     * @throws {AppError} 400 INVITATION_INVALID or 403 INVITATION_MISMATCH.
     */
    async completeExternal({ invitationHash, identity }, context = {}) {
      if (typeof invitationHash !== 'string' || !invitationHash) {
        throw refuse(ActivationDenial.INVITATION_UNKNOWN, context);
      }
      const now = clock.now();
      const pending = await loadPending(invitationHash, now, context);
      if (pending.method !== ActivationMethod.EXTERNAL) {
        throw refuse(ActivationDenial.METHOD_MISMATCH, context, {
          userId: String(pending.user._id),
        });
      }
      if (!isInvitedIdentity(pending.identities, identity)) {
        securityLogger.log('ACCOUNT_ACTIVATION_FAILED', {
          ip: context.ip,
          reason: ActivationDenial.IDENTITY_MISMATCH,
          userId: String(pending.user._id),
        });
        throw authError(AuthErrorCode.INVITATION_MISMATCH, 403);
      }
      await consumeAndActivate(
        { tokenHash: invitationHash, user: pending.user, method: ActivationMethod.EXTERNAL },
        context,
        now,
      );
    },
  };
}
