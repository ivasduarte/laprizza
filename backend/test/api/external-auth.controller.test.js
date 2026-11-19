import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createExternalAuthController, TRANSACTION_COOKIE } from '../../src/api/auth/external-auth.controller.js';
import { createTransactionCodec } from '../../src/infrastructure/oidc/oidc-transaction.js';

const CONFIG = {
  cookie: { name: 'lp_rt', secure: true, sameSite: 'strict', path: '/api/v1/auth' },
  external: { apiPublicUrl: 'https://api.pt', appCallbackUrl: 'https://app.pt/auth/callback', transactionTtlMs: 600_000 },
};
const EXPIRES = new Date('2026-11-25T10:00:00Z');
const codec = createTransactionCodec({ secret: 'k', ttlMs: 600_000 });
const TX = { provider: 'google', state: 's', nonce: 'n', codeVerifier: 'v' };

function res() {
  const r = {};
  for (const m of ['cookie', 'clearCookie', 'redirect', 'status', 'json']) r[m] = mock.fn(() => r);
  return r;
}
const req = (o = {}) => ({
  params: { provider: 'google' }, query: {}, cookies: {}, ip: '1.1.1.1',
  originalUrl: '/api/v1/auth/external/google/callback?code=c&state=s',
  get: () => 'ua', ...o,
});
const location = (r) => new URL(r.redirect.mock.calls.at(-1).arguments[1]);

function build(serviceOverrides = {}) {
  const service = {
    listProviders: mock.fn(() => [{ name: 'google', label: 'Google' }]),
    startLogin: mock.fn(async () => ({ authorizationUrl: 'https://idp/auth', transaction: TX })),
    completeLogin: mock.fn(async () => ({ outcome: 'SESSION', session: { refreshToken: 'rt', refreshTokenExpiresAt: EXPIRES } })),
    ...serviceOverrides,
  };
  return { service, controller: createExternalAuthController({ externalAuthService: service, transactionCodec: codec, config: CONFIG }) };
}

test('login: sets a signed httpOnly Lax transaction cookie and redirects to the IdP', async () => {
  const { controller } = build();
  const r = res();
  await controller.login(req(), r, () => {});
  const [name, value, opts] = r.cookie.mock.calls[0].arguments;
  assert.equal(name, TRANSACTION_COOKIE);
  assert.equal(codec.verify(value).state, 's');
  assert.deepEqual(opts, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/v1/auth/external', maxAge: 600_000 });
  assert.deepEqual(r.redirect.mock.calls[0].arguments, [302, 'https://idp/auth']);
});

test('login: unknown provider goes to next(err)', async () => {
  const boom = new Error('x');
  const { controller } = build({ startLogin: async () => { throw boom; } });
  const next = mock.fn();
  await controller.login(req(), res(), next);
  assert.equal(next.mock.calls[0].arguments[0], boom);
});

test('callback success: refresh cookie set, redirect has status=success and NO token', async () => {
  const { controller, service } = build();
  const r = res();
  await controller.callback(req({ cookies: { [TRANSACTION_COOKIE]: codec.sign(TX) } }), r, () => {});
  const [name, value, opts] = r.cookie.mock.calls[0].arguments;
  assert.equal(name, 'lp_rt');
  assert.equal(value, 'rt');
  assert.deepEqual(opts, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth', expires: EXPIRES });
  const url = location(r);
  assert.equal(url.origin + url.pathname, 'https://app.pt/auth/callback');
  assert.equal(url.searchParams.get('status'), 'success');
  assert.ok(!url.href.includes('rt') || url.href === 'https://app.pt/auth/callback?status=success');
  assert.equal(service.completeLogin.mock.calls[0].arguments[0].callbackUrl,
    'https://api.pt/api/v1/auth/external/google/callback?code=c&state=s');
  assert.equal(r.clearCookie.mock.calls[0].arguments[0], TRANSACTION_COOKIE); // single use
});

test('callback: user cancelled at the IdP -> ACCESS_DENIED, no session', async () => {
  const { controller, service } = build();
  const r = res();
  await controller.callback(req({ query: { error: 'access_denied' } }), r, () => {});
  assert.equal(location(r).searchParams.get('code'), 'ACCESS_DENIED');
  assert.equal(service.completeLogin.mock.callCount(), 0);
  assert.equal(r.cookie.mock.callCount(), 0);
});

test('callback: other IdP error -> AUTH_FAILED', async () => {
  const { controller } = build();
  const r = res();
  await controller.callback(req({ query: { error: 'server_error' } }), r, () => {});
  assert.equal(location(r).searchParams.get('code'), 'AUTH_FAILED');
});

test('callback: missing, tampered or other-provider transaction -> AUTH_FAILED without calling the service', async () => {
  for (const cookies of [{}, { [TRANSACTION_COOKIE]: 'x.y' }, { [TRANSACTION_COOKIE]: codec.sign({ ...TX, provider: 'microsoft' }) }]) {
    const { controller, service } = build();
    const r = res();
    await controller.callback(req({ cookies }), r, () => {});
    assert.equal(location(r).searchParams.get('code'), 'AUTH_FAILED');
    assert.equal(service.completeLogin.mock.callCount(), 0);
  }
});

test('callback: pending activation and mapped denial codes; no cookie is set', async () => {
  const cookies = { [TRANSACTION_COOKIE]: codec.sign(TX) };
  const pending = build({ completeLogin: async () => ({ outcome: 'PENDING_ACTIVATION' }) });
  let r = res();
  await pending.controller.callback(req({ cookies }), r, () => {});
  assert.equal(location(r).searchParams.get('code'), 'ACCOUNT_PENDING_ACTIVATION');
  assert.equal(r.cookie.mock.callCount(), 0);

  for (const code of ['ACCOUNT_INACTIVE', 'ACCOUNT_DISABLED', 'ACCOUNT_LINK_REQUIRED', 'EMAIL_NOT_VERIFIED']) {
    const b = build({ completeLogin: async () => { throw Object.assign(new Error('x'), { code }); } });
    r = res();
    await b.controller.callback(req({ cookies }), r, () => {});
    assert.equal(location(r).searchParams.get('code'), code);
  }
});

test('callback: unexpected error never leaks its message or code', async () => {
  const b = build({ completeLogin: async () => { throw Object.assign(new Error('mongo password=abc'), { code: 'E_INTERNAL_SECRET' }); } });
  const r = res();
  await b.controller.callback(req({ cookies: { [TRANSACTION_COOKIE]: codec.sign(TX) } }), r, () => {});
  const href = location(r).href;
  assert.equal(location(r).searchParams.get('code'), 'AUTH_FAILED');
  assert.ok(!href.includes('mongo') && !href.includes('SECRET'));
});

test('providers: lists enabled providers', () => {
  const { controller } = build();
  const r = res();
  controller.providers(req(), r);
  assert.deepEqual(r.json.mock.calls[0].arguments[0], [{ name: 'google', label: 'Google' }]);
});
