import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InvitationDenial,
  evaluateInvitationIssue,
  invitationExpiry,
  isInvitationUsable,
} from '../../src/domain/users/activation-invitation.domain.js';

const NOW = new Date('2026-11-20T10:00:00Z');
const HOUR = 3_600_000;
const pending = { email: 'new@laprizza.pt', status: 'inactive', activatedAt: null };

test('AA06: an invitation is issued only for an account that was never activated', () => {
  assert.deepEqual(evaluateInvitationIssue(pending), { allowed: true });
  assert.deepEqual(evaluateInvitationIssue({ ...pending, status: 'active' }), {
    allowed: false,
    reason: InvitationDenial.ACCOUNT_ALREADY_ACTIVATED,
  });
  // Inactive again after an activation (e.g. data fixed by hand): no second activation.
  assert.equal(
    evaluateInvitationIssue({ ...pending, activatedAt: NOW }).reason,
    InvitationDenial.ACCOUNT_ALREADY_ACTIVATED,
  );
  assert.equal(
    evaluateInvitationIssue({ ...pending, status: 'disabled' }).reason,
    InvitationDenial.ACCOUNT_DISABLED,
  );
  assert.equal(
    evaluateInvitationIssue({ ...pending, email: '' }).reason,
    InvitationDenial.EMAIL_MISSING,
  );
  assert.equal(evaluateInvitationIssue(null).reason, InvitationDenial.EMAIL_MISSING);
});

test('AA06: invitations expire after the configured time', () => {
  assert.deepEqual(invitationExpiry(NOW, 72 * HOUR), new Date('2026-11-23T10:00:00Z'));
  assert.throws(() => invitationExpiry(NOW, 0));
  assert.throws(() => invitationExpiry(NOW, Number.NaN));
});

test('AA06: an invitation is unusable once used, replaced or expired', () => {
  const invitation = { usedAt: null, revokedAt: null, expiresAt: new Date(NOW.getTime() + HOUR) };
  assert.equal(isInvitationUsable(invitation, NOW), true);
  assert.equal(isInvitationUsable({ ...invitation, usedAt: NOW }, NOW), false);
  assert.equal(isInvitationUsable({ ...invitation, revokedAt: NOW }, NOW), false);
  assert.equal(isInvitationUsable({ ...invitation, expiresAt: NOW }, NOW), false);
  assert.equal(isInvitationUsable(null, NOW), false);
});
