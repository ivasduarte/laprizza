import { AppError } from '../app-error.js';
import {
  evaluateInvitationIssue,
  invitationExpiry,
} from '../../domain/users/activation-invitation.domain.js';
import { ActorKind } from '../../domain/users/role-changes.domain.js';
import { buildActivationInvitationEmail } from './activation-invitation-email.js';

const actorLabel = (actor) =>
  actor.kind === ActorKind.USER ? `user:${actor.userId}` : `system:${actor.process}`;

/**
 * Activation invitations (AA06). Issuing replaces any pending invitation of the account, so
 * only the latest link works. The token is returned only inside the e-mail link.
 *
 * @param {object} deps
 * @param {object} deps.invitationsRepository - create, revokePendingForUser.
 * @param {object} deps.tokenService - generateOpaqueToken, hashOpaqueToken.
 * @param {{send: Function}} deps.emailService
 * @param {{now: () => Date}} deps.clock
 * @param {{log: Function}} deps.securityLogger
 * @param {{ttlMs: number, activationUrl: string}} deps.config - config.invitations.
 */
export function createActivationInvitationService({
  invitationsRepository,
  tokenService,
  emailService,
  clock,
  securityLogger,
  config,
}) {
  /**
   * Issues a new invitation and sends it to the account e-mail.
   * A failed e-mail does not undo the invitation: the Administrator can issue a replacement.
   *
   * @returns {Promise<{expiresAt: Date, sent: boolean}>}
   * @throws {AppError} 409 with EMAIL_MISSING, ACCOUNT_ALREADY_ACTIVATED or ACCOUNT_DISABLED.
   */
  async function issue(user, { issuedBy }) {
    const decision = evaluateInvitationIssue(user);
    if (!decision.allowed) {
      throw new AppError(
        'An activation invitation cannot be issued for this account.',
        409,
        null,
        decision.reason,
      );
    }

    const now = clock.now();
    const expiresAt = invitationExpiry(now, config.ttlMs);
    const token = tokenService.generateOpaqueToken();

    await invitationsRepository.revokePendingForUser(user._id, now);
    await invitationsRepository.create({
      tokenHash: tokenService.hashOpaqueToken(token),
      userId: user._id,
      email: user.email,
      issuedBy,
      createdAt: now,
      expiresAt,
      usedAt: null,
      revokedAt: null,
    });

    let sent = true;
    try {
      // The token goes in the fragment (#): browsers never send it to a server nor in the Referer.
      await emailService.send({
        to: user.email,
        ...buildActivationInvitationEmail({
          activationUrl: `${config.activationUrl}#token=${token}`,
          expiresInHours: Math.round(config.ttlMs / 3_600_000),
        }),
      });
    } catch (err) {
      sent = false;
      securityLogger.log('ACTIVATION_INVITATION_EMAIL_FAILED', {
        userId: String(user._id),
        reason: err?.name ?? 'Error',
      });
    }

    securityLogger.log('ACTIVATION_INVITATION_ISSUED', {
      userId: String(user._id),
      issuedBy: actorLabel(issuedBy),
      sent,
    });
    return { expiresAt, sent };
  }

  /** Pending invitations of the account stop working (account disabled). */
  async function revokePending(userId) {
    await invitationsRepository.revokePendingForUser(userId, clock.now());
  }

  return { issue, revokePending };
}
