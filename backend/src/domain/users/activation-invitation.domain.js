import { AccountStatus } from './users.domain.js';

/**
 * AA06: a newly created inactive account receives a unique activation invitation at its
 * intended e-mail address. The invitation expires, is single-use and can be replaced by an
 * Administrator. It is consumed by the activation flow (AA07).
 */
export const InvitationDenial = Object.freeze({
  EMAIL_MISSING: 'EMAIL_MISSING',
  ACCOUNT_ALREADY_ACTIVATED: 'ACCOUNT_ALREADY_ACTIVATED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
});

/**
 * Whether an invitation may be issued (or replaced) for the account.
 * Only accounts that were never activated get one: adding a role to an active account never
 * requires a new activation.
 *
 * @param {{email?: string, status?: string, activatedAt?: Date|null}} user
 * @returns {{allowed: true} | {allowed: false, reason: string}}
 */
export function evaluateInvitationIssue(user) {
  if (!user?.email) return { allowed: false, reason: InvitationDenial.EMAIL_MISSING };
  if (user.status === AccountStatus.DISABLED) {
    return { allowed: false, reason: InvitationDenial.ACCOUNT_DISABLED };
  }
  if (user.status !== AccountStatus.INACTIVE || user.activatedAt) {
    return { allowed: false, reason: InvitationDenial.ACCOUNT_ALREADY_ACTIVATED };
  }
  return { allowed: true };
}

/**
 * Expiry of an invitation issued at `now`.
 *
 * @param {Date} now
 * @param {number} ttlMs - Must be positive.
 * @returns {Date}
 */
export function invitationExpiry(now, ttlMs) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0)
    throw new Error('The invitation TTL must be positive.');
  return new Date(now.getTime() + ttlMs);
}

/**
 * An invitation is usable while it is neither used, replaced nor expired.
 *
 * @param {{usedAt?: Date|null, revokedAt?: Date|null, expiresAt?: Date}|null} invitation
 * @param {Date} now
 * @returns {boolean}
 */
export function isInvitationUsable(invitation, now) {
  return Boolean(
    invitation &&
    !invitation.usedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt instanceof Date &&
    invitation.expiresAt.getTime() > now.getTime(),
  );
}
