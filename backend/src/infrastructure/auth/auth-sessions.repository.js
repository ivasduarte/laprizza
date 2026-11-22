import mongoose from 'mongoose';
import AuthSession from './auth-session.model.js';

const MAX_ROTATED_HASHES = 200;

export async function create(data) {
  return AuthSession.create(data);
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AuthSession.findById(id).lean();
}

/**
 * Atomically swaps the refresh token of a usable session.
 * @param {{idleSince?: Date|null}} [options] - AA04: sessions last used before this date are idle.
 */
export async function rotateRefreshToken(currentHash, nextHash, now, { idleSince = null } = {}) {
  const filter = { refreshTokenHash: currentHash, revokedAt: null, expiresAt: { $gt: now } };
  if (idleSince) filter.lastUsedAt = { $gt: idleSince };
  return AuthSession.findOneAndUpdate(
    filter,
    {
      $set: { refreshTokenHash: nextHash, lastUsedAt: now },
      $push: { rotatedHashes: { $each: [currentHash], $slice: -MAX_ROTATED_HASHES } },
    },
    { returnDocument: 'after' },
  ).lean();
}

/** AA04: records activity on the session (inactivity window). */
export async function touch(id, now) {
  return AuthSession.updateOne({ _id: id, revokedAt: null }, { $set: { lastUsedAt: now } });
}

export async function findByRotatedHash(hash) {
  return AuthSession.findOne({ rotatedHashes: hash }).lean();
}

export async function revoke(id, now) {
  return AuthSession.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: now } });
}

export async function revokeAllForUser(userId, now, { exceptSessionId } = {}) {
  const filter = { userId, revokedAt: null };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  return AuthSession.updateMany(filter, { $set: { revokedAt: now } });
}