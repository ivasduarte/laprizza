import ExternalIdentities from './external-identity.model.js';

/** @returns {Promise<Object|null>} The linked identity or null. */
export async function findByIssuerAndSubject(issuer, subject) {
  return ExternalIdentities.findOne({ issuer, subject });
}

/** @returns {Promise<Object[]>} */
export async function findByUserId(userId) {
  return ExternalIdentities.find({ userId });
}

/**
 * @param {{userId: string, provider: string, issuer: string, subject: string}} identity
 * @throws {Error} code 11000 if (issuer, subject) or (userId, provider) already exists.
 */
export async function create(identity) {
  return ExternalIdentities.create(identity);
}
