/**
 * In-memory dummy of login-throttle.repository.js (wait for non-existent emails).
 *
 * @returns {Object} The dummy repository instance.
 */
export function createDummyLoginThrottleRepository() {
  const entries = new Map();

  return {
    findByKey: async (keyHash) => entries.get(keyHash) ?? null,

    registerFailure: async (keyHash, now, retentionMs) => {
      const entry = entries.get(keyHash) ?? { keyHash, failedCount: 0, lockedUntil: null };
      entry.failedCount += 1;
      entry.expiresAt = new Date(now.getTime() + retentionMs);
      entries.set(keyHash, entry);
      return entry;
    },

    extendLockout: async (keyHash, lockedUntil) => {
      const entry = entries.get(keyHash);
      if (entry && (!entry.lockedUntil || lockedUntil > entry.lockedUntil)) entry.lockedUntil = lockedUntil;
    },

    /** Test helper: raw access to the entries. */
    _getEntries: () => [...entries.values()],
  };
}
