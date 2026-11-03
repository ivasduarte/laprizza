import Users from './users.model.js';

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

export async function findByEmailWithPasswordHash(email) {
  return Users.findOne({ email }).select('+passwordHash');
}

export async function findByIdWithPasswordHash(id) {
  return Users.findById(id).select('+passwordHash');
}

export async function findByEmail(email) {
  return Users.findOne({ email });
}

export async function registerFailedLogin(id) {
  return Users.findByIdAndUpdate(id, { $inc: { failedLoginCount: 1 } }, { returnDocument: 'after' });
}

export async function extendLockout(id, lockedUntil) {
  return Users.updateOne({ _id: id }, { $max: { lockedUntil } })
}

export async function clearLoginFailures(id) {
  return Users.updateOne({ _id: id }, { $set: {failedLoginCount: 0, lockedUntil: null } });
}

export async function setPasswordHash(id, passwordHash, { revokeTokens = false } = {}) {
  const update = { $set: { passwordHash, failedLoginCount: 0, lockedUntil: null } };
  if (revokeTokens) update.$inc = { tokenVersion: 1 };
  return Users.findByIdAndUpdate(id, update, { returnDocument: 'after' });
}

export async function incrementTokenVersion(id) {
  return Users.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
}