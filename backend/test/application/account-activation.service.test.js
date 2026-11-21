import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountActivationService } from '../../src/application/auth/account-activation.service.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

const NOW = new Date('2026-11-20T10:00:00Z');
const EXPIRES = new Date('2026-11-23T10:00:00Z');
const CTX = { ip: '10.0.0.1', userAgent: 'node-test' };
const PASSWORD = 'StrongPassword123!';
const TOKEN = 'A'.repeat(43);
const USER_ID = 'abcdef000000000000000001';

const tokenService = createTokenService({ jwtSecret: 'test', accessTokenTtlSeconds: 60 });
const TOKEN_HASH = tokenService.hashOpaqueToken(TOKEN);

const pendingUser = (data = {}) => ({
  _id: USER_ID,
  email: 'maria.silva@laprizza.pt',
  roles: ['CUSTOMER', 'EMPLOYEE'],
  status: 'inactive',
  activatedAt: null,
  ...data,
});
const invitationFor = (data = {}) => ({
  tokenHash: TOKEN_HASH,
  userId: USER_ID,
  email: 'maria.silva@laprizza.pt',
  expiresAt: EXPIRES,
  usedAt: null,
  revokedAt: null,
  ...data,
});
const GOOGLE_IDENTITY = {
  userId: USER_ID,
  provider: 'google',
  issuer: 'https://accounts.google.com',
  subject: 'g-1',
};

/**
 * Builds the service with repositories that answer as MongoDB would for the given data
 * (consume and activateAccount are conditional: null when nothing changed).
 */
function build({ invitation = invitationFor(), user = pendingUser(), identities = [] } = {}) {
  const deps = {
    invitationsRepository: {
      findByTokenHash: mock.fn(async (hash) =>
        invitation?.tokenHash === hash ? invitation : null,
      ),
      consume: mock.fn(async (hash) =>
        invitation?.tokenHash === hash && !invitation.usedAt
          ? { ...invitation, usedAt: NOW }
          : null,
      ),
    },
    usersRepository: {
      findById: mock.fn(async (id) => (user && String(user._id) === String(id) ? user : null)),
      activateAccount: mock.fn(async (id, data) => ({ ...user, status: 'active', ...data })),
    },
    externalIdentitiesRepository: { findByUserId: mock.fn(async () => identities) },
    passwordHasher: { hash: mock.fn(async (p) => `hash(${p})`) },
    tokenService,
    securityLogger: { log: mock.fn() },
    clock: { now: () => NOW },
  };
  return { deps, service: createAccountActivationService(deps) };
}

const logged = (deps, event) =>
  deps.securityLogger.log.mock.calls
    .filter((c) => c.arguments[0] === event)
    .map((c) => c.arguments[1]);

// ---------- inspect ----------

test('AA07 inspect: a local invitation shows the local step, the masked e-mail and the expiry', async () => {
  const { service, deps } = build();
  assert.deepEqual(await service.inspect({ token: TOKEN }, CTX), {
    method: 'local',
    email: 'm***a@laprizza.pt',
    expiresAt: EXPIRES,
  });
  // Nothing is used nor changed.
  assert.equal(deps.invitationsRepository.consume.mock.callCount(), 0);
  assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
  // Only the hash is looked up.
  assert.deepEqual(deps.invitationsRepository.findByTokenHash.mock.calls[0].arguments, [
    TOKEN_HASH,
  ]);
});

test('AA07 inspect: an account with a linked identity must be activated at that provider', async () => {
  const { service } = build({ identities: [GOOGLE_IDENTITY] });
  const out = await service.inspect({ token: TOKEN }, CTX);
  assert.equal(out.method, 'external');
  assert.equal(out.provider, 'google');
});

test('AA07 inspect: unknown, used, replaced or expired links answer the same INVITATION_INVALID', async () => {
  const cases = [
    build({ invitation: null }),
    build({ invitation: invitationFor({ usedAt: NOW }) }),
    build({ invitation: invitationFor({ revokedAt: NOW }) }),
    build({ invitation: invitationFor({ expiresAt: new Date('2026-11-19T10:00:00Z') }) }),
    build({ user: pendingUser({ status: 'disabled' }) }),
    build({ user: pendingUser({ status: 'active', activatedAt: NOW }) }),
    build({ user: null }),
  ];
  for (const { service, deps } of cases) {
    await assert.rejects(service.inspect({ token: TOKEN }, CTX), {
      status: 400,
      code: 'INVITATION_INVALID',
    });
    // The real reason is only in the security log.
    assert.equal(logged(deps, 'ACCOUNT_ACTIVATION_FAILED').length, 1);
  }
});

// ---------- local activation ----------

test('AA07 local: the user sets the password and the account becomes active', async () => {
  const { service, deps } = build();
  await service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX);

  assert.deepEqual(deps.invitationsRepository.consume.mock.calls[0].arguments, [TOKEN_HASH, NOW]);
  assert.deepEqual(deps.usersRepository.activateAccount.mock.calls[0].arguments, [
    USER_ID,
    { activatedAt: NOW, passwordHash: `hash(${PASSWORD})` },
  ]);
  assert.deepEqual(logged(deps, 'ACCOUNT_ACTIVATED'), [
    { userId: USER_ID, method: 'local', ip: CTX.ip },
  ]);
});

test('AA07 local: activation changes no roles and grants no consent (only status, date and password)', async () => {
  const { service, deps } = build();
  await service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX);
  const [, data] = deps.usersRepository.activateAccount.mock.calls[0].arguments;
  assert.deepEqual(Object.keys(data).sort(), ['activatedAt', 'passwordHash']);
});

test('AA07 local: a weak password is refused before the link is used', async () => {
  const { service, deps } = build();
  await assert.rejects(service.activateLocal({ token: TOKEN, newPassword: 'weak' }, CTX), {
    status: 400,
    code: 'PASSWORD_POLICY_VIOLATION',
  });
  assert.equal(deps.invitationsRepository.findByTokenHash.mock.callCount(), 0);
  assert.equal(deps.invitationsRepository.consume.mock.callCount(), 0);
});

test('AA07 local: invalid, used or expired links do not activate the account', async () => {
  for (const invitation of [
    null,
    invitationFor({ usedAt: NOW }),
    invitationFor({ revokedAt: NOW }),
    invitationFor({ expiresAt: NOW }),
  ]) {
    const { service, deps } = build({ invitation });
    await assert.rejects(service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX), {
      code: 'INVITATION_INVALID',
    });
    assert.equal(deps.invitationsRepository.consume.mock.callCount(), 0);
    assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
  }
});

test('AA07 local: an external account cannot be activated by setting a password', async () => {
  const { service, deps } = build({ identities: [GOOGLE_IDENTITY] });
  await assert.rejects(service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX), {
    code: 'INVITATION_INVALID',
  });
  assert.equal(deps.invitationsRepository.consume.mock.callCount(), 0);
  assert.equal(logged(deps, 'ACCOUNT_ACTIVATION_FAILED')[0].reason, 'METHOD_MISMATCH');
});

test('AA07 local: a link used by a concurrent request (consume returns null) activates nothing', async () => {
  const { service, deps } = build();
  deps.invitationsRepository.consume.mock.mockImplementation(async () => null);
  await assert.rejects(service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX), {
    code: 'INVITATION_INVALID',
  });
  assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
});

test('AA07 local: an account disabled in the meantime stays disabled (conditional update)', async () => {
  const { service, deps } = build();
  deps.usersRepository.activateAccount.mock.mockImplementation(async () => null);
  await assert.rejects(service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX), {
    code: 'INVITATION_INVALID',
  });
  assert.equal(logged(deps, 'ACCOUNT_ACTIVATED').length, 0);
  assert.equal(logged(deps, 'ACCOUNT_ACTIVATION_FAILED')[0].reason, 'ACCOUNT_NOT_PENDING');
});

test('AA07: the security log never contains the token, its hash, the password or the e-mail', async () => {
  const { service, deps } = build();
  await service.activateLocal({ token: TOKEN, newPassword: PASSWORD }, CTX);
  const failing = build({ invitation: null });
  await assert.rejects(failing.service.inspect({ token: TOKEN }, CTX));
  const logs = JSON.stringify([
    ...deps.securityLogger.log.mock.calls,
    ...failing.deps.securityLogger.log.mock.calls,
  ]);
  for (const secret of [TOKEN, TOKEN_HASH, PASSWORD, 'maria.silva@laprizza.pt']) {
    assert.ok(!logs.includes(secret), secret);
  }
});

// ---------- external activation ----------

test('AA07 external: prepareExternal returns the linked provider and the token hash (not the token)', async () => {
  const { service } = build({ identities: [GOOGLE_IDENTITY] });
  assert.deepEqual(await service.prepareExternal({ token: TOKEN }, CTX), {
    provider: 'google',
    invitationHash: TOKEN_HASH,
  });
});

test('AA07 external: a local account cannot start an external activation', async () => {
  const { service } = build();
  await assert.rejects(service.prepareExternal({ token: TOKEN }, CTX), {
    code: 'INVITATION_INVALID',
  });
});

test('AA07 external: the linked identity activates the account, without a password', async () => {
  const { service, deps } = build({ identities: [GOOGLE_IDENTITY] });
  await service.completeExternal(
    { invitationHash: TOKEN_HASH, identity: { issuer: GOOGLE_IDENTITY.issuer, subject: 'g-1' } },
    CTX,
  );
  assert.deepEqual(deps.usersRepository.activateAccount.mock.calls[0].arguments, [
    USER_ID,
    { activatedAt: NOW },
  ]);
  assert.deepEqual(logged(deps, 'ACCOUNT_ACTIVATED'), [
    { userId: USER_ID, method: 'external', ip: CTX.ip },
  ]);
});

test('AA07 external: another identity is refused (403 INVITATION_MISMATCH), link unused, account inactive', async () => {
  const { service, deps } = build({ identities: [GOOGLE_IDENTITY] });
  await assert.rejects(
    service.completeExternal(
      { invitationHash: TOKEN_HASH, identity: { issuer: GOOGLE_IDENTITY.issuer, subject: 'g-2' } },
      CTX,
    ),
    { status: 403, code: 'INVITATION_MISMATCH' },
  );
  assert.equal(deps.invitationsRepository.consume.mock.callCount(), 0);
  assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
  assert.equal(logged(deps, 'ACCOUNT_ACTIVATION_FAILED')[0].reason, 'IDENTITY_MISMATCH');
});

test('AA07 external: an expired or replaced link fails even after a successful provider login', async () => {
  for (const invitation of [
    invitationFor({ expiresAt: NOW }),
    invitationFor({ revokedAt: NOW }),
    invitationFor({ usedAt: NOW }),
  ]) {
    const { service, deps } = build({ invitation, identities: [GOOGLE_IDENTITY] });
    await assert.rejects(
      service.completeExternal(
        {
          invitationHash: TOKEN_HASH,
          identity: { issuer: GOOGLE_IDENTITY.issuer, subject: 'g-1' },
        },
        CTX,
      ),
      { status: 400, code: 'INVITATION_INVALID' },
    );
    assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
  }
});

test('AA07 external: a transaction without the invitation hash activates nothing', async () => {
  const { service, deps } = build({ identities: [GOOGLE_IDENTITY] });
  await assert.rejects(service.completeExternal({ identity: GOOGLE_IDENTITY }, CTX), {
    code: 'INVITATION_INVALID',
  });
  assert.equal(deps.invitationsRepository.findByTokenHash.mock.callCount(), 0);
});
