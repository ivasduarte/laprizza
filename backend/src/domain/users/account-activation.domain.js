import { AccountStatus, normalizeEmail } from './users.domain.js';

/**
 * Rules of the account activation. Pure functions, used by the
 * activation service for local and external accounts.
 */

/** How an invited account is activated. */
export const ActivationMethod = Object.freeze({
  /** The user sets the password of the account (accounts created by an Administrator). */
  LOCAL: 'local',
  /** The user signs in at the identity provider already linked to the account (AA02). */
  EXTERNAL: 'external',
});

/**
 * Why an activation was refused. Only the security log sees these reasons: the API answers
 * every one of them with the same INVITATION_INVALID (or INVITATION_MISMATCH for an identity
 * that is not the intended one), so the answer never says whether a link or an account exists.
 */
export const ActivationDenial = Object.freeze({
  INVITATION_UNKNOWN: 'INVITATION_UNKNOWN',
  INVITATION_USED: 'INVITATION_USED',
  INVITATION_REPLACED: 'INVITATION_REPLACED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_NOT_PENDING: 'ACCOUNT_NOT_PENDING',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
  METHOD_MISMATCH: 'METHOD_MISMATCH',
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
});

const deny = (reason) => ({ allowed: false, reason });

/**
 * Whether the invitation can still be used: known, not used, not replaced and not expired.
 *
 * @param {{usedAt?: Date|null, revokedAt?: Date|null, expiresAt?: Date}|null} invitation
 * @param {Date} now
 * @returns {{allowed: true} | {allowed: false, reason: string}}
 */
export function evaluateInvitationUse(invitation, now) {
  if (!invitation) return deny(ActivationDenial.INVITATION_UNKNOWN);
  if (invitation.usedAt) return deny(ActivationDenial.INVITATION_USED);
  if (invitation.revokedAt) return deny(ActivationDenial.INVITATION_REPLACED);
  const expiresAt = new Date(invitation.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return deny(ActivationDenial.INVITATION_EXPIRED);
  }
  return { allowed: true };
}

/**
 * Whether the invitation may activate its account now. The account must still be waiting for
 * its first activation (inactive and never activated: a disabled account is not reactivated
 * through an old link) and must still have the e-mail the invitation was sent to.
 *
 * @param {{invitation: object|null, user: object|null, now: Date}} facts
 * @returns {{allowed: true} | {allowed: false, reason: string}}
 */
export function evaluateAccountActivation({ invitation, user, now }) {
  const invitationDecision = evaluateInvitationUse(invitation, now);
  if (!invitationDecision.allowed) return invitationDecision;
  if (!user) return deny(ActivationDenial.ACCOUNT_NOT_FOUND);
  if (user.status !== AccountStatus.INACTIVE || user.activatedAt) {
    return deny(ActivationDenial.ACCOUNT_NOT_PENDING);
  }
  if (!user.email || normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
    return deny(ActivationDenial.EMAIL_CHANGED);
  }
  return { allowed: true };
}

/**
 * Activation method of an account. An account with a linked external identity was created by
 * its first external login (AA02) and is activated at that provider; any other account was
 * created by an Administrator (AA06) and is activated by setting its password.
 *
 * @param {Array<{provider: string}>} identities - External identities linked to the account.
 * @returns {{method: 'local'} | {method: 'external', provider: string}}
 */
export function activationMethodFor(identities) {
  const [identity] = Array.isArray(identities) ? identities : [];
  return identity
    ? { method: ActivationMethod.EXTERNAL, provider: identity.provider }
    : { method: ActivationMethod.LOCAL };
}

/**
 * The identity authenticated at the provider must be the one linked to the invited
 * account (same issuer and subject). The e-mail is not enough: it can be changed at the provider.
 *
 * @param {Array<{issuer: string, subject: string}>} identities - Identities of the account.
 * @param {{issuer: string, subject: string}} authenticated - Identity from the validated id_token.
 * @returns {boolean}
 */
export function isInvitedIdentity(identities, authenticated) {
  if (!Array.isArray(identities) || !authenticated) return false;
  return identities.some(
    (identity) =>
      identity.issuer === authenticated.issuer && identity.subject === authenticated.subject,
  );
}

/**
 * E-mail shown on the activation page, so the user can confirm the invitation is theirs
 * without the page revealing the full address to whoever holds the link.
 * "maria.silva@laprizza.pt" -> "m***a@laprizza.pt".
 *
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at < 1) return '***';
  const local = normalized.slice(0, at);
  const masked = local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local.at(-1)}`;
  return `${masked}${normalized.slice(at)}`;
}
