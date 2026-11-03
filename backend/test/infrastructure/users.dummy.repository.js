/**
 * Factory function that creates an in-memory dummy users repository for testing.
 * Implements the same interface as the real infrastructure repository (users.repository.js),
 * including the AA01 operations (failed logins, lockout, password hash and tokenVersion).
 *
 * @returns {Object} The dummy repository instance.
 */
export function createDummyUsersRepository() {
  const users = [];
  let idCounter = 1;

  /** Finds a user by its simulated hex ID. */
  const byId = (id) => users.find((u) => String(u._id) === String(id));
  /** Finds a user by email (already normalized by the caller). */
  const byEmail = (email) => users.find((u) => u.email === email);

  return {
    /** @returns {Promise<Object[]>} Every user. */
    listUsers: async () => users,

    /** @returns {Promise<Object|undefined>} The user with that ID. */
    findById: async (id) => byId(id),

    /** In memory the hash is always present; kept for interface parity. */
    findByIdWithPasswordHash: async (id) => byId(id),

    /** @returns {Promise<Object|undefined>} The user with that email. */
    findByEmail: async (email) => byEmail(email),

    /** In memory the hash is always present; kept for interface parity. */
    findByEmailWithPasswordHash: async (email) => byEmail(email),

    /**
     * Simulates saving a new user. Throws a duplicate key error (11000)
     * when the email or username already exists.
     */
    create: async (userData) => {
      const exists = users.find(
        (u) =>
          (userData.email && u.email === userData.email) ||
          (userData.username && u.username === userData.username),
      );
      if (exists) {
        const error = new Error('Duplicate key');
        error.code = 11000;
        throw error;
      }

      // 24-character hex string (e.g. 'abcdef000000000000000001')
      const hexId = 'abcdef' + (idCounter++).toString(16).padStart(18, '0');
      const newUser = {
        _id: hexId,
        status: 'inactive',
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: 0,
        ...userData,
      };
      users.push(newUser);
      return newUser;
    },

    /** Simulates findByIdAndUpdate with plain fields ($set). */
    update: async (id, data) => {
      const index = users.findIndex((u) => String(u._id) === String(id));
      if (index === -1) return null;
      users[index] = { ...users[index], ...data };
      return users[index];
    },

    /** Simulates the atomic $inc of failedLoginCount. */
    registerFailedLogin: async (id) => {
      const user = byId(id);
      if (!user) return null;
      user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
      return user;
    },

    /** Simulates $max on lockedUntil (keeps the longest wait). */
    extendLockout: async (id, lockedUntil) => {
      const user = byId(id);
      if (user && (!user.lockedUntil || lockedUntil > user.lockedUntil)) user.lockedUntil = lockedUntil;
    },

    clearLoginFailures: async (id) => {
      const user = byId(id);
      if (user) Object.assign(user, { failedLoginCount: 0, lockedUntil: null });
    },

    setPasswordHash: async (id, passwordHash, { revokeTokens = false } = {}) => {
      const user = byId(id);
      if (!user) return null;
      Object.assign(user, { passwordHash, failedLoginCount: 0, lockedUntil: null });
      if (revokeTokens) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      return user;
    },

    incrementTokenVersion: async (id) => {
      const user = byId(id);
      if (!user) return null;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      return user;
    },

    /** Test helper: raw access to the in-memory array. */
    _getUsers: () => users,
  };
}
