import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExternalAuthService,
  ExternalLoginOutcome,
} from '../../src/application/auth/external-auth.service.js';

const PROVIDER = {
  name: 'google', label: 'Google', issuer: 'https://accounts.google.com',
  emailVerifiedClaim: 'email_verified',
};
const CLAIMS = { iss: 'https://accounts.google.com', sub: 'g-1', email: 'Ana@Example.pt', email_verified: true };
const CTX = { ip: '10.0.0.1', userAgent: 'node-test' };
const NOW = new Date('2026-11-21T10:00:00.000Z');

function build({ claims = CLAIMS, linked = null, user = null, emailOwner = null, exchange } = {}) {
  const deps = {
    usersRepository: {
      findByEmail: mock.fn(async () => emailOwner),
      findById: mock.fn(async () => user),
      create: mock.fn(async (data) => ({ _id: 'new-id', ...data })),
      deleteById: mock.fn(async () => ({ deletedCount: 1 })),
      activateAccount: mock.fn(async (id, { activatedAt }) => ({ _id: id, status: 'active', activatedAt })),
    },
    externalIdentitiesRepository: {
      findByIssuerAndSubject: mock.fn(async () => linked),
      create: mock.fn(async (d) => d),
    },
    oidcClient: {
      createAuthorizationRequest: mock.fn(async () => ({
        authorizationUrl: 'https://idp/authorize?x=1',
        transaction: { state: 's', nonce: 'n', codeVerifier: 'v' },
      })),
      completeAuthorization: mock.fn(exchange ?? (async () => claims)),
    },
    authService: { establishSession: mock.fn(async () => ({ refreshToken: 'rt', accessToken: 'at' })) },
    roleChangeRecorder: { recordInitialRoles: mock.fn(async () => {}) },
    invitationService: { issue: mock.fn(async () => ({ expiresAt: new Date(), sent: true })) },
    activationService: {
      prepareExternal: mock.fn(async () => ({ provider: 'google', invitationHash: 'hash-1' })),
      completeExternal: mock.fn(async () => {}),
    },
    securityLogger: { log: mock.fn() },
    config: { providers: { google: PROVIDER } },
    clock: { now: () => NOW },
  };
  return { deps, service: createExternalAuthService(deps) };
}
const input = { providerName: 'google', callbackUrl: 'https://api/cb?code=c&state=s', transaction: { state: 's' } };

test('listProviders exposes only name and label (no secrets)', () => {
  const { service } = build();
  assert.deepEqual(service.listProviders(), [{ name: 'google', label: 'Google' }]);
});

test('startLogin: unknown provider -> 404 PROVIDER_NOT_FOUND (also __proto__)', async () => {
  const { service } = build();
  for (const name of ['facebook', '__proto__', 'constructor']) {
    await assert.rejects(service.startLogin(name), { status: 404, code: 'PROVIDER_NOT_FOUND' });
  }
});

test('startLogin returns the IdP url and a transaction tagged with the provider', async () => {
  const { service } = build();
  const out = await service.startLogin('google');
  assert.equal(out.authorizationUrl, 'https://idp/authorize?x=1');
  assert.deepEqual(out.transaction, { state: 's', nonce: 'n', codeVerifier: 'v', provider: 'google' });
});

test('linked + active user: session through establishSession with method oidc, nothing created', async () => {
  const user = { _id: 'u1', status: 'active' };
  const { service, deps } = build({ linked: { userId: 'u1' }, user });
  const out = await service.completeLogin(input, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.SESSION);
  assert.deepEqual(deps.authService.establishSession.mock.calls[0].arguments, [user, { ...CTX, method: 'oidc' }]);
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
  assert.equal(deps.usersRepository.findByEmail.mock.callCount(), 0);
});

test('linked but deactivated/disabled: the denial of establishSession propagates, no new account', async () => {
  const denial = Object.assign(new Error('x'), { status: 403, code: 'ACCOUNT_INACTIVE' });
  const deactivated = { _id: 'u1', status: 'inactive', activatedAt: new Date('2026-01-01') };
  const { service, deps } = build({ linked: { userId: 'u1' }, user: deactivated });
  deps.authService.establishSession.mock.mockImplementation(async () => { throw denial; });
  await assert.rejects(service.completeLogin(input, CTX), { code: 'ACCOUNT_INACTIVE' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
});

test('AA02: new verified e-mail: ACTIVE account with CUSTOMER role, identity linked, session opened', async () => {
  const { service, deps } = build();
  const out = await service.completeLogin(input, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.SESSION);
  assert.deepEqual(out.session, { refreshToken: 'rt', accessToken: 'at' });
  assert.deepEqual(deps.usersRepository.create.mock.calls[0].arguments[0], {
    email: 'ana@example.pt', roles: ['CUSTOMER'], status: 'active', activatedAt: NOW,
  });
  assert.deepEqual(deps.externalIdentitiesRepository.create.mock.calls[0].arguments[0], {
    userId: 'new-id', provider: 'google', issuer: 'https://accounts.google.com', subject: 'g-1',
  });
  const [sessionUser, sessionCtx] = deps.authService.establishSession.mock.calls[0].arguments;
  assert.equal(sessionUser._id, 'new-id');
  assert.deepEqual(sessionCtx, { ...CTX, method: 'oidc' });
});

test('AA02: the first external login sends no activation invitation', async () => {
  const { service, deps } = build();
  await service.completeLogin(input, CTX);
  assert.equal(deps.invitationService.issue.mock.callCount(), 0);
});

test('AA02: a failed identity link removes the new account (no orphan blocking the e-mail)', async () => {
  const { service, deps } = build();
  deps.externalIdentitiesRepository.create.mock.mockImplementation(async () => { throw new Error('db'); });
  await assert.rejects(service.completeLogin(input, CTX), { message: 'db' });
  assert.deepEqual(deps.usersRepository.deleteById.mock.calls[0].arguments, ['new-id']);
  assert.equal(deps.authService.establishSession.mock.callCount(), 0);
});

test('AA02: concurrent first login of the same identity: account removed, AUTH_FAILED, no session', async () => {
  const { service, deps } = build();
  deps.externalIdentitiesRepository.create.mock.mockImplementation(async () => {
    throw Object.assign(new Error('dup'), { code: 11000 });
  });
  await assert.rejects(service.completeLogin(input, CTX), { status: 409, code: 'AUTH_FAILED' });
  assert.equal(deps.usersRepository.deleteById.mock.callCount(), 1);
  assert.equal(deps.authService.establishSession.mock.callCount(), 0);
});

test('existing e-mail without linked identity: ACCOUNT_LINK_REQUIRED, nothing created, no session', async () => {
  const { service, deps } = build({ emailOwner: { _id: 'u9' } });
  await assert.rejects(service.completeLogin(input, CTX), { status: 403, code: 'ACCOUNT_LINK_REQUIRED' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
  assert.equal(deps.authService.establishSession.mock.callCount(), 0);
});

test('unverified or missing e-mail on a new identity is denied', async () => {
  const unverified = build({ claims: { ...CLAIMS, email_verified: false } });
  await assert.rejects(unverified.service.completeLogin(input, CTX), { code: 'EMAIL_NOT_VERIFIED' });
  const missing = build({ claims: { iss: CLAIMS.iss, sub: 'g-1' } });
  await assert.rejects(missing.service.completeLogin(input, CTX), { code: 'EMAIL_MISSING' });
});

test('IdP exchange failure: 401 AUTH_FAILED, no lookups; the log keeps only the error name', async () => {
  const boom = Object.assign(new Error('secret detail from idp'), { name: 'ResponseBodyError' });
  const { service, deps } = build({ exchange: async () => { throw boom; } });
  await assert.rejects(service.completeLogin(input, CTX), { status: 401, code: 'AUTH_FAILED' });
  assert.equal(deps.externalIdentitiesRepository.findByIssuerAndSubject.mock.callCount(), 0);
  assert.ok(!JSON.stringify(deps.securityLogger.log.mock.calls).includes('secret detail'));
});

test('duplicate e-mail race on user creation maps to ACCOUNT_LINK_REQUIRED', async () => {
  const { service, deps } = build();
  deps.usersRepository.create.mock.mockImplementation(async () => { throw Object.assign(new Error('dup'), { code: 11000 }); });
  await assert.rejects(service.completeLogin(input, CTX), { code: 'ACCOUNT_LINK_REQUIRED' });
  assert.equal(deps.externalIdentitiesRepository.create.mock.callCount(), 0);
});

test('security log never contains the e-mail', async () => {
  const { service, deps } = build({ emailOwner: { _id: 'u9' } });
  await assert.rejects(service.completeLogin(input, CTX));
  assert.ok(!JSON.stringify(deps.securityLogger.log.mock.calls).toLowerCase().includes('example.pt'));
});

test('AA03: roles or groups sent by the identity provider are ignored; new accounts get only CUSTOMER', async () => {
  const { service, deps } = build({
    claims: { ...CLAIMS, roles: ['MANAGER'], groups: ['admins'], 'https://laprizza/roles': ['MANAGER'] },
  });
  await service.completeLogin(input, CTX);
  const created = deps.usersRepository.create.mock.calls[0].arguments[0];
  assert.deepEqual(created.roles, ['CUSTOMER']);
  assert.equal(created.status, 'active'); // activated by the verified identity (AA02), not by the role
});

test('AA03: a linked account without active roles is denied by establishSession (same rule as local)', async () => {
  const denial = Object.assign(new Error('x'), { status: 403, code: 'NO_ACTIVE_ROLE' });
  const { service, deps } = build({ linked: { userId: 'u1' }, user: { _id: 'u1', status: 'active', roles: [] } });
  deps.authService.establishSession.mock.mockImplementation(async () => { throw denial; });
  await assert.rejects(service.completeLogin(input, CTX), { code: 'NO_ACTIVE_ROLE' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0); // never recreated
});

test('AA06: first external login records CUSTOMER as a system process', async () => {
  const { service, deps } = build();
  await service.completeLogin(input, CTX);

  const [user, actor] = deps.roleChangeRecorder.recordInitialRoles.mock.calls[0].arguments;
  assert.deepEqual(user.roles, ['CUSTOMER']);
  assert.deepEqual(actor, { kind: 'SYSTEM', process: 'external-first-login' });
});

test('AA06: a failed role record never blocks the login; it is logged for the Administrator', async () => {
  const { service, deps } = build();
  deps.roleChangeRecorder.recordInitialRoles.mock.mockImplementation(async () => { throw new Error('db'); });

  const out = await service.completeLogin(input, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.SESSION);
  const events = deps.securityLogger.log.mock.calls.map((c) => c.arguments[0]);
  assert.ok(events.includes('ROLE_CHANGE_RECORD_FAILED'));
});

test('AA06: selecting an authentication method never grants an administrative role', async () => {
  const claims = { ...CLAIMS, roles: ['ADMINISTRATOR'], groups: ['ADMINISTRATOR', 'MANAGER'] };
  const { service, deps } = build({ claims });
  await service.completeLogin(input, CTX);
  assert.deepEqual(deps.usersRepository.create.mock.calls[0].arguments[0].roles, ['CUSTOMER']);
});

test('AA06: a returning external user gets no new invitation and no role record', async () => {
  const { service, deps } = build({ linked: { userId: 'u1' }, user: { _id: 'u1', status: 'active' } });
  await service.completeLogin(input, CTX);
  assert.equal(deps.invitationService.issue.mock.callCount(), 0);
  assert.equal(deps.roleChangeRecorder.recordInitialRoles.mock.callCount(), 0);
});

test('AA07: a linked account still waiting for activation is activated by the external login', async () => {
  const pending = { _id: 'u1', status: 'inactive', activatedAt: null };
  const { service, deps } = build({ linked: { userId: 'u1' }, user: pending });
  const out = await service.completeLogin(input, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.SESSION);
  assert.deepEqual(deps.usersRepository.activateAccount.mock.calls[0].arguments, ['u1', { activatedAt: NOW }]);
  assert.equal(deps.authService.establishSession.mock.calls[0].arguments[0].status, 'active');
});

test('AA03: a deactivated (already activated) or disabled linked account is never reactivated', async () => {
  for (const user of [
    { _id: 'u1', status: 'inactive', activatedAt: new Date('2026-01-01') },
    { _id: 'u1', status: 'disabled', activatedAt: null },
  ]) {
    const { service, deps } = build({ linked: { userId: 'u1' }, user });
    await service.completeLogin(input, CTX);
    assert.equal(deps.usersRepository.activateAccount.mock.callCount(), 0);
    assert.equal(deps.authService.establishSession.mock.calls[0].arguments[0], user);
  }
});

// ---------- AA07: activation of external accounts ----------

const TOKEN = 'A'.repeat(43);
const activationInput = {
  ...input,
  transaction: { state: 's', provider: 'google', purpose: 'activation', invitationHash: 'hash-1' },
};

test('AA07: startActivation goes to the provider linked to the account, keeping only the token hash', async () => {
  const { service, deps } = build();
  const out = await service.startActivation({ token: TOKEN }, CTX);
  assert.deepEqual(deps.activationService.prepareExternal.mock.calls[0].arguments, [{ token: TOKEN }, CTX]);
  assert.equal(out.authorizationUrl, 'https://idp/authorize?x=1');
  assert.deepEqual(out.transaction, {
    state: 's', nonce: 'n', codeVerifier: 'v',
    provider: 'google', purpose: 'activation', invitationHash: 'hash-1',
  });
  assert.ok(!JSON.stringify(out.transaction).includes(TOKEN));
});

test('AA07: startActivation with an invalid invitation never reaches the provider', async () => {
  const { service, deps } = build();
  const invalid = Object.assign(new Error('x'), { status: 400, code: 'INVITATION_INVALID' });
  deps.activationService.prepareExternal.mock.mockImplementation(async () => { throw invalid; });
  await assert.rejects(service.startActivation({ token: TOKEN }, CTX), { code: 'INVITATION_INVALID' });
  assert.equal(deps.oidcClient.createAuthorizationRequest.mock.callCount(), 0);
});

test('AA07: startActivation for a provider disabled in this deployment -> PROVIDER_NOT_FOUND', async () => {
  const { service, deps } = build();
  deps.activationService.prepareExternal.mock.mockImplementation(async () => ({
    provider: 'microsoft', invitationHash: 'hash-1',
  }));
  await assert.rejects(service.startActivation({ token: TOKEN }, CTX), { status: 404, code: 'PROVIDER_NOT_FOUND' });
});

test('AA07: an activation callback activates through the activation service, never logs in nor creates', async () => {
  const { service, deps } = build({ linked: { userId: 'u1' }, user: { _id: 'u1', status: 'inactive' } });
  const out = await service.completeLogin(activationInput, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.ACTIVATED);
  const [args] = deps.activationService.completeExternal.mock.calls[0].arguments;
  assert.deepEqual(args, {
    invitationHash: 'hash-1',
    identity: { provider: 'google', issuer: 'https://accounts.google.com', subject: 'g-1' },
  });
  assert.equal(deps.authService.establishSession.mock.callCount(), 0);
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
  assert.equal(deps.externalIdentitiesRepository.create.mock.callCount(), 0);
});

test('AA07: an activation callback with another identity propagates INVITATION_MISMATCH, no account created', async () => {
  const { service, deps } = build();
  const mismatch = Object.assign(new Error('x'), { status: 403, code: 'INVITATION_MISMATCH' });
  deps.activationService.completeExternal.mock.mockImplementation(async () => { throw mismatch; });
  await assert.rejects(service.completeLogin(activationInput, CTX), { code: 'INVITATION_MISMATCH' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
  assert.equal(deps.authService.establishSession.mock.callCount(), 0);
});

test('AA07: a failed provider login during activation activates nothing', async () => {
  const { service, deps } = build({ exchange: async () => { throw new Error('denied'); } });
  await assert.rejects(service.completeLogin(activationInput, CTX), { code: 'AUTH_FAILED' });
  assert.equal(deps.activationService.completeExternal.mock.callCount(), 0);
});
