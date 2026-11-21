import ActivationInvitation from './activation-invitation.model.js';

export async function create(data) {
  return ActivationInvitation.create(data);
}

/** Makes every pending invitation of the user unusable (replacement or account disabled). */
export async function revokePendingForUser(userId, now) {
  return ActivationInvitation.updateMany(
    { userId, usedAt: null, revokedAt: null },
    { $set: { revokedAt: now } },
  );
}

/**
 * Atomically marks a usable invitation as used (AA07).
 *
 * @returns {Promise<Object|null>} The invitation, or null if it is unknown, used, replaced or expired.
 */
export async function consume(tokenHash, now) {
  return ActivationInvitation.findOneAndUpdate(
    { tokenHash, usedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: 'after' },
  ).lean();
}

/**
 * Reads an invitation without using it (The activation page checks the link before the
 * user submits).
 *
 * @returns {Promise<Object|null>}
 */
export async function findByTokenHash(tokenHash) {
  return ActivationInvitation.findOne({ tokenHash }).lean();
}
