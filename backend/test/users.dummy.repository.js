/**
 * Factory function that creates an in-memory dummy users repository for testing.
 * Implements the same interface as the real infrastructure repository.
 * Simulates database operations, constraints (like duplicate key errors), and ObjectId generation.
 *
 * @returns {Object} The dummy repository instance containing mocked database operations.
 */
export function createDummyUsersRepository() {
  const users = [];
  let idCounter = 1;

  return {
    /**
     * Retrieves all users from the in-memory array.
     *
     * @returns {Promise<Object[]>} A promise resolving to an array of user documents.
     */
    listUsers: async () => users,

    /**
     * Finds a user by their simulated MongoDB hex ID.
     *
     * @param {string} id - The 24-character hex string ID.
     * @returns {Promise<Object|undefined>} A promise resolving to the user document, or undefined if not found.
     */
    findById: async (id) => {
      return users.find((u) => String(u._id) === String(id));
    },

    /**
     * Finds a user by their email or username.
     *
     * @param {string} identifier - The email or username.
     * @returns {Promise<Object|undefined>} A promise resolving to the user document, or undefined if not found.
     */
    findByEmailOrUsername: async (identifier) => {
      return users.find((u) => u.email === identifier || u.username === identifier);
    },

    /**
     * Simulates saving a new user to the database.
     * Generates a 24-character hex ID. Throws a simulated MongoDB duplicate key error (11000)
     * if the email or username already exists.
     *
     * @param {Object} userData - The data for the new user.
     * @returns {Promise<Object>} A promise resolving to the newly created user document.
     * @throws {Error} Throws if a user with the same email or username already exists.
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

      // Generates a 24-character hex string with letters (e.g., 'abcdef000000000000000001')
      const hexId = 'abcdef' + (idCounter++).toString(16).padStart(18, '0');
      const newUser = { _id: hexId, ...userData };

      users.push(newUser);
      return newUser;
    },

    /**
     * Simulates updating an existing user in the database.
     *
     * @param {string} id - The simulated MongoDB hex ID of the user to update.
     * @param {Object} data - The fields to update.
     * @returns {Promise<Object|null>} A promise resolving to the updated user document, or null if not found.
     */
    update: async (id, data) => {
      const index = users.findIndex((u) => String(u._id) === String(id));
      if (index === -1) return null;

      users[index] = { ...users[index], ...data };
      return users[index];
    },

    /**
     * Internal helper method used strictly for test assertions to access the raw in-memory array.
     *
     * @returns {Object[]} The raw array of user documents.
     */
    _getUsers: () => users,
  };
}