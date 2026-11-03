/**
 * In-memory dummy of password-reset-tokens.repository.js.
 *
 * @returns {Object} The dummy repository instance.
 */
export function createDummyPasswordResetTokensRepository() {
  let tokens = [];

  return {
    create: async (data) => {
      const record = { usedAt: null, ...data };
      tokens.push(record);
      return record;
    },

    invalidateActiveForUser: async (userId) => {
      tokens = tokens.filter((t) => !(String(t.userId) === String(userId) && !t.usedAt));
    },

    consume: async (tokenHash, now) => {
      const record = tokens.find((t) => t.tokenHash === tokenHash && !t.usedAt && t.expiresAt > now);
      if (!record) return null;
      record.usedAt = now;
      return record;
    },

    /** Test helper: raw access to the stored records. */
    _getTokens: () => tokens,
  };
}
