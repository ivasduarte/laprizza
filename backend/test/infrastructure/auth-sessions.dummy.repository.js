/**
 * In-memory dummy of auth-sessions.repository.js.
 * Reproduces the conditions of the atomic operations (rotation only with the current hash,
 * a non-revoked and non-expired session).
 *
 * @returns {Object} The dummy repository instance.
 */
export function createDummyAuthSessionsRepository() {
  const sessions = [];
  let idCounter = 1;

  const byId = (id) => sessions.find((s) => String(s._id) === String(id));

  return {
    create: async (data) => {
      const session = {
        _id: 'bbbbbb' + (idCounter++).toString(16).padStart(18, '0'),
        rotatedHashes: [],
        revokedAt: null,
        ...data,
      };
      sessions.push(session);
      return session;
    },

    findById: async (id) => byId(id) ?? null,

    rotateRefreshToken: async (currentHash, nextHash, now) => {
      const session = sessions.find(
        (s) => s.refreshTokenHash === currentHash && !s.revokedAt && s.expiresAt > now,
      );
      if (!session) return null;
      session.rotatedHashes.push(currentHash);
      session.refreshTokenHash = nextHash;
      session.lastUsedAt = now;
      return session;
    },

    findByRotatedHash: async (hash) => sessions.find((s) => s.rotatedHashes.includes(hash)) ?? null,

    revoke: async (id, now) => {
      const session = byId(id);
      if (session && !session.revokedAt) session.revokedAt = now;
    },

    revokeAllForUser: async (userId, now, { exceptSessionId } = {}) => {
      for (const session of sessions) {
        const sameUser = String(session.userId) === String(userId);
        const isException = exceptSessionId && String(session._id) === String(exceptSessionId);
        if (sameUser && !session.revokedAt && !isException) session.revokedAt = now;
      }
    },

    /** Test helper: raw access to the sessions. */
    _getSessions: () => sessions,
  };
}
