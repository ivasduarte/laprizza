import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createExternalAuthService, ExternalLoginOutcome } from '../../src/application/auth/external-auth.service.js';

const PROVIDER = {
  name: 'google', label: 'Google', issuer: 'https://accounts.google.com',
  emailVerifiedClaim: 'email_verified',
};
const CLAIMS = { iss: 'https://accounts.google.com', sub: 'g-1', email: 'Ana@Example.pt', email_verified: true };
const CTX = { ip: '10.0.0.1', userAgent: 'node-test' };

function build({ claims = CLAIMS, linked = null, user = null, emailOwner = null, exchange } = {}) {
  const deps = {
    usersRepository: {
      findByEmail: mock.fn(async () => emailOwner),
      findById: mock.fn(async () => user),
      create: mock.fn(async (data) => ({ _id: 'new-id', ...data })),
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
    securityLogger: { log: mock.fn() },
    config: { providers: { google: PROVIDER } },
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

test('linked but inactive/disabled: the denial of establishSession propagates, no new account', async () => {
  const denial = Object.assign(new Error('x'), { status: 403, code: 'ACCOUNT_INACTIVE' });
  const { service, deps } = build({ linked: { userId: 'u1' }, user: { _id: 'u1', status: 'inactive' } });
  deps.authService.establishSession.mock.mockImplementation(async () => { throw denial; });
  await assert.rejects(service.completeLogin(input, CTX), { code: 'ACCOUNT_INACTIVE' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0);
});

test('new verified e-mail: INACTIVE account with CUSTOMER role, identity linked, NO session', async () => {
  const { service, deps } = build();
  const out = await service.completeLogin(input, CTX);
  assert.equal(out.outcome, ExternalLoginOutcome.PENDING_ACTIVATION);
  assert.deepEqual(deps.usersRepository.create.mock.calls[0].arguments[0], {
    email: 'ana@example.pt', roles: ['CUSTOMER'], status: 'inactive',
  });
  assert.deepEqual(deps.externalIdentitiesRepository.create.mock.calls[0].arguments[0], {
    userId: 'new-id', provider: 'google', issuer: 'https://accounts.google.com', subject: 'g-1',
  });
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
  assert.equal(created.status, 'inactive'); // Customer does not activate the account
});

test('AA03: a linked account without active roles is denied by establishSession (same rule as local)', async () => {
  const denial = Object.assign(new Error('x'), { status: 403, code: 'NO_ACTIVE_ROLE' });
  const { service, deps } = build({ linked: { userId: 'u1' }, user: { _id: 'u1', status: 'active', roles: [] } });
  deps.authService.establishSession.mock.mockImplementation(async () => { throw denial; });
  await assert.rejects(service.completeLogin(input, CTX), { code: 'NO_ACTIVE_ROLE' });
  assert.equal(deps.usersRepository.create.mock.callCount(), 0); // never recreated
});
