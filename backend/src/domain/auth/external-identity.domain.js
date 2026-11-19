import { normalizeEmail } from '../users/users.domain.js';

export const ExternalProvider = Object.freeze({
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
});

export const ExternalLoginDecision = Object.freeze({
  LOGIN: 'LOGIN',
  CREATE_ACCOUNT: 'CREATE_ACCOUNT',
  DENY: 'DENY',
});

export const ExternalLoginDenial = Object.freeze({
  EMAIL_MISSING: 'EMAIL_MISSING',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LINK_REQUIRED: 'ACCOUNT_LINK_REQUIRED',
});

const MAX_FIELD_LENGTH = 255;

/**
 * Value object: the identity of a user at an external IdP, identified by (issuer, subject).
 *
 * @param {{provider: string, issuer: string, subject: string}} data
 * @returns {Readonly<{provider: string, issuer: string, subject: string}>}
 * @throws {Error} If any field is invalid.
 */
export function createExternalIdentity({ provider, issuer, subject }) {
  if (!Object.values(ExternalProvider).includes(provider)) {
    throw new Error('Invalid external provider.');
  }
  for (const [field, value] of Object.entries({ issuer, subject })) {
    if (typeof value !== 'string' || !value.trim() || value.length > MAX_FIELD_LENGTH) {
      throw new Error(`Invalid external identity ${field}.`);
    }
  }
  return Object.freeze({ provider, issuer: issuer.trim(), subject: subject.trim() });
}

const isTrue = (v) => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Extracts what the application needs from validated id_token claims.
 *
 * @param {Record<string, unknown>} claims - Claims already validated (signature, iss, aud, exp, nonce).
 * @param {{emailVerifiedClaim: string}} providerConfig
 * @returns {{subject: string, email: string, emailVerified: boolean}} `email` is '' if absent.
 */
export function extractIdentityClaims(claims, { emailVerifiedClaim }) {
  return {
    subject: typeof claims?.sub === 'string' ? claims.sub : '',
    email: normalizeEmail(claims?.email),
    emailVerified: isTrue(claims?.[emailVerifiedClaim]),
  };
}

/**
 * Decides what to do with a validated external login. Pure function.
 *
 * @param {{hasLinkedUser: boolean, email: string, emailVerified: boolean, emailOwnerExists: boolean}} facts
 * @returns {{decision: string, reason?: string}}
 */
export function resolveExternalLogin({ hasLinkedUser, email, emailVerified, emailOwnerExists }) {
  if (hasLinkedUser) return { decision: ExternalLoginDecision.LOGIN };
  const deny = (reason) => ({ decision: ExternalLoginDecision.DENY, reason });
  if (!email) return deny(ExternalLoginDenial.EMAIL_MISSING);
  if (!emailVerified) return deny(ExternalLoginDenial.EMAIL_NOT_VERIFIED);
  if (emailOwnerExists) return deny(ExternalLoginDenial.ACCOUNT_LINK_REQUIRED);
  return { decision: ExternalLoginDecision.CREATE_ACCOUNT };
}
