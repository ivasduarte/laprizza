import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExternalIdentity,
  extractIdentityClaims,
  resolveExternalLogin,
  ExternalLoginDecision as D,
  ExternalLoginDenial as R,
} from '../../src/domain/auth/external-identity.domain.js';

const facts = (o = {}) => ({
  hasLinkedUser: false, email: 'a@b.pt', emailVerified: true, emailOwnerExists: false, ...o,
});

test('createExternalIdentity returns a frozen, trimmed value object', () => {
  const id = createExternalIdentity({ provider: 'google', issuer: ' https://accounts.google.com ', subject: '123' });
  assert.deepEqual(id, { provider: 'google', issuer: 'https://accounts.google.com', subject: '123' });
  assert.ok(Object.isFrozen(id));
});

test('createExternalIdentity rejects unknown provider and empty/oversized fields', () => {
  const ok = { provider: 'google', issuer: 'i', subject: 's' };
  assert.throws(() => createExternalIdentity({ ...ok, provider: 'facebook' }), /provider/);
  assert.throws(() => createExternalIdentity({ ...ok, issuer: '  ' }), /issuer/);
  assert.throws(() => createExternalIdentity({ ...ok, subject: undefined }), /subject/);
  assert.throws(() => createExternalIdentity({ ...ok, subject: 'x'.repeat(256) }), /subject/);
});

test('extractIdentityClaims normalizes e-mail and reads the provider verification claim', () => {
  const g = extractIdentityClaims({ sub: 's', email: ' A@B.PT ', email_verified: true }, { emailVerifiedClaim: 'email_verified' });
  assert.deepEqual(g, { subject: 's', email: 'a@b.pt', emailVerified: true });
  const m = extractIdentityClaims({ sub: 's', email: 'a@b.pt', xms_edov: '1' }, { emailVerifiedClaim: 'xms_edov' });
  assert.equal(m.emailVerified, true);
});

test('extractIdentityClaims treats a missing/false claim as NOT verified', () => {
  const cfg = { emailVerifiedClaim: 'email_verified' };
  assert.equal(extractIdentityClaims({ sub: 's', email: 'a@b.pt' }, cfg).emailVerified, false);
  assert.equal(extractIdentityClaims({ sub: 's', email: 'a@b.pt', email_verified: 'false' }, cfg).emailVerified, false);
  assert.equal(extractIdentityClaims({}, cfg).email, '');
});

test('linked identity always logs in (even without verified e-mail)', () => {
  assert.deepEqual(resolveExternalLogin(facts({ hasLinkedUser: true, email: '', emailVerified: false })), { decision: D.LOGIN });
});

test('unlinked identity: denials in order and account creation', () => {
  assert.deepEqual(resolveExternalLogin(facts({ email: '' })), { decision: D.DENY, reason: R.EMAIL_MISSING });
  assert.deepEqual(resolveExternalLogin(facts({ emailVerified: false })), { decision: D.DENY, reason: R.EMAIL_NOT_VERIFIED });
  assert.deepEqual(resolveExternalLogin(facts({ emailOwnerExists: true })), { decision: D.DENY, reason: R.ACCOUNT_LINK_REQUIRED });
  assert.deepEqual(resolveExternalLogin(facts()), { decision: D.CREATE_ACCOUNT });
});
