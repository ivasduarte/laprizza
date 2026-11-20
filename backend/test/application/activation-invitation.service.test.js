import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createActivationInvitationService } from '../../src/application/users/activation-invitation.service.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

const NOW = new Date('2026-11-20T10:00:00Z');
const TTL_MS = 72 * 3_600_000;
const ACTIVATION_URL = 'http://localhost:4200/activate';
const ADMIN = { kind: 'USER', userId: 'abcdef000000000000000099' };
const PENDING = {
  _id: 'abcdef000000000000000001',
  email: 'new@laprizza.pt',
  status: 'inactive',
  activatedAt: null,
};

const tokenService = createTokenService({ jwtSecret: 'test', accessTokenTtlSeconds: 60 });

function build() {
  const invitationsRepository = {
    create: mock.fn(async (data) => data),
    revokePendingForUser: mock.fn(async () => ({})),
  };
  const emailService = { send: mock.fn(async () => {}) };
  const securityLogger = { log: mock.fn() };
  const service = createActivationInvitationService({
    invitationsRepository,
    tokenService,
    emailService,
    clock: { now: () => NOW },
    securityLogger,
    config: { ttlMs: TTL_MS, activationUrl: ACTIVATION_URL },
  });
  return { service, invitationsRepository, emailService, securityLogger };
}

const tokenOf = (text) => text.match(/#token=([A-Za-z0-9_-]{43})/)[1];

test('AA06: the invitation goes to the intended e-mail with a single link and no password', async () => {
  const { service, emailService } = build();
  const result = await service.issue(PENDING, { issuedBy: ADMIN });

  assert.deepEqual(result, { expiresAt: new Date(NOW.getTime() + TTL_MS), sent: true });
  const { to, subject, text } = emailService.send.mock.calls[0].arguments[0];
  assert.equal(to, 'new@laprizza.pt');
  assert.match(subject, /activation/i);
  assert.ok(text.includes(`${ACTIVATION_URL}#token=`));
  assert.match(text, /72/);
  assert.doesNotMatch(text, /password:/i);
});

test('AA06: only the hash of the token is stored, with the expiry, the issuer and the e-mail', async () => {
  const { service, invitationsRepository, emailService } = build();
  await service.issue(PENDING, { issuedBy: ADMIN });

  const stored = invitationsRepository.create.mock.calls[0].arguments[0];
  const token = tokenOf(emailService.send.mock.calls[0].arguments[0].text);
  assert.equal(stored.tokenHash, tokenService.hashOpaqueToken(token));
  assert.ok(!JSON.stringify(stored).includes(token));
  assert.equal(stored.email, 'new@laprizza.pt');
  assert.deepEqual(stored.issuedBy, ADMIN);
  assert.deepEqual(stored.expiresAt, new Date(NOW.getTime() + TTL_MS));
  assert.equal(stored.usedAt, null);
  assert.equal(stored.revokedAt, null);
});

test('AA06: every invitation is unique and replaces the previous one', async () => {
  const { service, invitationsRepository, emailService } = build();
  await service.issue(PENDING, { issuedBy: ADMIN });
  await service.issue(PENDING, { issuedBy: ADMIN });

  const [first, second] = emailService.send.mock.calls.map((c) => tokenOf(c.arguments[0].text));
  assert.notEqual(first, second);
  assert.equal(invitationsRepository.revokePendingForUser.mock.callCount(), 2);
  assert.deepEqual(invitationsRepository.revokePendingForUser.mock.calls[1].arguments, [
    PENDING._id,
    NOW,
  ]);
});

test('AA06: no invitation for an activated or disabled account', async () => {
  const { service, invitationsRepository, emailService } = build();
  for (const [user, code] of [
    [{ ...PENDING, status: 'active' }, 'ACCOUNT_ALREADY_ACTIVATED'],
    [{ ...PENDING, status: 'disabled' }, 'ACCOUNT_DISABLED'],
  ]) {
    await assert.rejects(service.issue(user, { issuedBy: ADMIN }), { status: 409, code });
  }
  assert.equal(invitationsRepository.create.mock.callCount(), 0);
  assert.equal(emailService.send.mock.callCount(), 0);
});

test('AA06: a failed e-mail keeps the invitation and is reported without the address', async () => {
  const { service, invitationsRepository, emailService, securityLogger } = build();
  emailService.send.mock.mockImplementation(async () => {
    throw Object.assign(new Error('smtp down for new@laprizza.pt'), { name: 'SmtpError' });
  });

  const result = await service.issue(PENDING, { issuedBy: ADMIN });
  assert.equal(result.sent, false);
  assert.equal(invitationsRepository.create.mock.callCount(), 1);
  const logged = JSON.stringify(securityLogger.log.mock.calls.map((c) => c.arguments));
  assert.ok(logged.includes('ACTIVATION_INVITATION_EMAIL_FAILED'));
  assert.ok(!logged.includes('new@laprizza.pt'));
});

test('AA06: disabling an account revokes its pending invitations', async () => {
  const { service, invitationsRepository } = build();
  await service.revokePending(PENDING._id);
  assert.deepEqual(invitationsRepository.revokePendingForUser.mock.calls[0].arguments, [
    PENDING._id,
    NOW,
  ]);
});
