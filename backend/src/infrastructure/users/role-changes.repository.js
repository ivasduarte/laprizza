import RoleChange from './role-change.model.js';

/** Appends role change records (AA06). */
export async function insertMany(changes) {
  return RoleChange.insertMany(changes, { ordered: true });
}

/** Role changes of a user, newest first. */
export async function listForUser(userId, { limit = 100 } = {}) {
  return RoleChange.find({ userId }).sort({ at: -1, _id: -1 }).limit(limit).lean();
}
