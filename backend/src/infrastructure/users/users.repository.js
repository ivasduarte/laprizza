import Users from './users.model.js';

/**
 * Finds a user by their unique identifier (either email or username).
 * Explicitly forces Mongoose to return the 'password' field (using select('+password'))
 * which is hidden by default in the schema, so it can be verified during the login process.
 *
 * @param {string} identifier - The email or username of the user to find.
 * @returns {Promise<Object|null>} A promise that resolves to the user document or null if not found.
 */
export async function findByEmailOrUsername(identifier) {
  return Users.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+password');
}

/**
 * Creates and saves a new user document in the database.
 *
 * @param {Object} userData - The data for the new user.
 * @returns {Promise<Object>} A promise that resolves to the newly created user document.
 */
export async function create(userData) {
  return Users.create(userData);
}

/**
 * Retrieves all user documents from the database.
 *
 * @returns {Promise<Object[]>} A promise that resolves to an array of user documents.
 */
export async function listUsers() {
  return Users.find();
}

/**
 * Finds a user document by its MongoDB ObjectId.
 *
 * @param {string} id - The MongoDB ObjectId of the user.
 * @returns {Promise<Object|null>} A promise that resolves to the user document or null if not found.
 */
export async function findById(id) {
  return Users.findById(id);
}

/**
 * Updates an existing user document by its MongoDB ObjectId.
 * Uses the { returnDocument: 'after' } option to ensure the returned document
 * reflects the newly updated state, rather than the state before the update.
 *
 * @param {string} id - The MongoDB ObjectId of the user to update.
 * @param {Object} updateData - An object containing the fields to update.
 * @returns {Promise<Object|null>} A promise that resolves to the updated user document or null if not found.
 */
export async function update(id, updateData) {
  return Users.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
}