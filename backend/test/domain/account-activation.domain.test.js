import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActivationDenial,
  ActivationMethod,
  activationMethodFor,
  evaluateAccountActivation,
  evaluateInvitationUse,
  isInvitedIdentity,
  maskEmail,
} from '../../src/domain/users/account-activation.domain.js';

const NOW = new Date('2026-11-20T10:00:00Z');
const LATER = new Date('2026-11-23T10:00:00Z');
const INVITATION = {
  userId: 'u1',
  email: 'new@laprizza.pt',
  expiresAt: LATER,
  usedAt: null,
  revokedAt: null,
};
const PENDING = { _id: 'u1', email: 'new@laprizza.pt', status: 'inactive', activatedAt: null };

test('AA07: a known, unused, not replaced and not expired invitation can be used', () => {
  assert.deepEqual(evaluateInvitationUse(INVITATION, NOW), { allowed: true });
});

test('AA07: unknown, used, replaced and expired invitations are refused with their reason', () => {
  const cases = [
    [null, ActivationDenial.INVITATION_UNKNOWN],
    [{ ...INVITATION, usedAt: NOW }, ActivationDenial.INVITATION_USED],
    [{ ...INVITATION, revokedAt: NOW }, ActivationDenial.INVITATION_REPLACED],
    [{ ...INVITATION, expiresAt: NOW }, ActivationDenial.INVITATION_EXPIRED], // expires at "now"
    [
      { ...INVITATION, expiresAt: new Date('2026-11-19T10:00:00Z') },
      ActivationDenial.INVITATION_EXPIRED,
    ],
    [{ ...INVITATION, expiresAt: 'not a date' }, ActivationDenial.INVITATION_EXPIRED],
  ];
  for (const [invitation, reason] of cases) {
    assert.deepEqual(evaluateInvitationUse(invitation, NOW), { allowed: false, reason });
  }
});

test('AA07: an inactive account never activated, with the invited e-mail, can be activated', () => {
  assert.deepEqual(evaluateAccountActivation({ invitation: INVITATION, user: PENDING, now: NOW }), {
    allowed: true,
  });
  // The e-mail is compared normalized.
  const upper = { ...PENDING, email: ' NEW@LaPrizza.pt ' };
  assert.equal(
    evaluateAccountActivation({ invitation: INVITATION, user: upper, now: NOW }).allowed,
    true,
  );
});

test('AA07: an active, disabled or already activated account is not activated again', () => {
  for (const user of [
    { ...PENDING, status: 'active' },
    { ...PENDING, status: 'disabled' },
    { ...PENDING, status: 'inactive', activatedAt: NOW }, // activated before, now disabled/inactive
  ]) {
    assert.deepEqual(evaluateAccountActivation({ invitation: INVITATION, user, now: NOW }), {
      allowed: false,
      reason: ActivationDenial.ACCOUNT_NOT_PENDING,
    });
  }
});

test('AA07: the invitation must still match the account (unknown account, e-mail changed)', () => {
  assert.equal(
    evaluateAccountActivation({ invitation: INVITATION, user: null, now: NOW }).reason,
    ActivationDenial.ACCOUNT_NOT_FOUND,
  );
  assert.equal(
    evaluateAccountActivation({
      invitation: INVITATION,
      user: { ...PENDING, email: 'other@laprizza.pt' },
      now: NOW,
    }).reason,
    ActivationDenial.EMAIL_CHANGED,
  );
});

test('AA07: the invitation is checked before the account', () => {
  assert.equal(
    evaluateAccountActivation({ invitation: { ...INVITATION, usedAt: NOW }, user: null, now: NOW })
      .reason,
    ActivationDenial.INVITATION_USED,
  );
});

test('AA07: an account with a linked identity is activated at its provider, any other locally', () => {
  assert.deepEqual(activationMethodFor([]), { method: ActivationMethod.LOCAL });
  assert.deepEqual(activationMethodFor(undefined), { method: ActivationMethod.LOCAL });
  assert.deepEqual(activationMethodFor([{ provider: 'google', issuer: 'i', subject: 's' }]), {
    method: ActivationMethod.EXTERNAL,
    provider: 'google',
  });
});

test('AA07: only the identity linked to the account (same issuer and subject) matches', () => {
  const identities = [
    { provider: 'google', issuer: 'https://accounts.google.com', subject: 'g-1' },
  ];
  assert.equal(
    isInvitedIdentity(identities, { issuer: 'https://accounts.google.com', subject: 'g-1' }),
    true,
  );
  assert.equal(
    isInvitedIdentity(identities, { issuer: 'https://accounts.google.com', subject: 'g-2' }),
    false,
  );
  assert.equal(
    isInvitedIdentity(identities, { issuer: 'https://evil.example', subject: 'g-1' }),
    false,
  );
  assert.equal(
    isInvitedIdentity([], { issuer: 'https://accounts.google.com', subject: 'g-1' }),
    false,
  );
  assert.equal(isInvitedIdentity(identities, null), false);
});

test('AA07: the e-mail shown on the activation page is masked', () => {
  assert.equal(maskEmail('maria.silva@laprizza.pt'), 'm***a@laprizza.pt');
  assert.equal(maskEmail('Ab@laprizza.pt'), 'a***@laprizza.pt');
  assert.equal(maskEmail('x@laprizza.pt'), 'x***@laprizza.pt');
  assert.equal(maskEmail('not-an-email'), '***');
  assert.equal(maskEmail(undefined), '***');
});
