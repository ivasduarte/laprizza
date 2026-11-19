import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOidcConfig as load } from '../../src/infrastructure/oidc/oidc.config.js';

const loadOidcConfig = (env, options = { apiPrefix: '/api/v2' }) => load(env, options);
const BASE = { API_PUBLIC_URL: 'https://laprizza.example.pt/' };
const GOOGLE = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' };
const MS = { MICROSOFT_CLIENT_ID: 'mid', MICROSOFT_CLIENT_SECRET: 'msecret', MICROSOFT_TENANT: 'consumers' };

test('no provider configured: disabled, no API_PUBLIC_URL needed', () => {
  const c = loadOidcConfig({});
  assert.equal(c.enabled, false);
  assert.deepEqual(c.providers, {});
  assert.equal(c.appCallbackUrl, 'http://localhost:4200/auth/callback');
  assert.equal(c.transactionTtlMs, 600_000);
});

test('Google enabled: issuer, redirect URI and verification claim', () => {
  const g = loadOidcConfig({ ...BASE, ...GOOGLE }).providers.google;
  assert.equal(g.issuer, 'https://accounts.google.com');
  assert.equal(g.redirectUri, 'https://laprizza.example.pt/api/v2/auth/external/google/callback');
  assert.equal(g.emailVerifiedClaim, 'email_verified');
});

test('redirect URI follows the injected API prefix; prefix is required when a provider is enabled', () => {
  assert.equal(
    loadOidcConfig({ ...BASE, ...GOOGLE }, { apiPrefix: '/api/v3' }).providers.google.redirectUri,
    'https://laprizza.example.pt/api/v3/auth/external/google/callback',
  );
  assert.throws(() => loadOidcConfig({ ...BASE, ...GOOGLE }, {}), /API prefix is required/);
  assert.doesNotThrow(() => loadOidcConfig({}, {})); // nothing enabled: no prefix needed
});

test('Microsoft enabled: tenant-specific issuer', () => {
  const m = loadOidcConfig({ ...BASE, ...MS }).providers.microsoft;
  assert.equal(m.issuer, 'https://login.microsoftonline.com/consumers/v2.0');
});

test('half-configured provider is a startup error', () => {
  assert.throws(() => loadOidcConfig({ ...BASE, GOOGLE_CLIENT_ID: 'gid' }), /set together/);
  assert.throws(() => loadOidcConfig({ ...BASE, GOOGLE_CLIENT_SECRET: 'x' }), /set together/);
});

test('API_PUBLIC_URL: required, https unless localhost', () => {
  assert.throws(() => loadOidcConfig({ ...GOOGLE }), /API_PUBLIC_URL is required/);
  assert.throws(() => loadOidcConfig({ API_PUBLIC_URL: 'http://vs814.dei.isep.ipp.pt', ...GOOGLE }), /https/);
  assert.doesNotThrow(() => loadOidcConfig({ API_PUBLIC_URL: 'http://localhost:3000', ...GOOGLE }));
  assert.throws(() => loadOidcConfig({ API_PUBLIC_URL: 'not a url', ...GOOGLE }), /not a valid URL/);
  assert.throws(() => loadOidcConfig({ API_PUBLIC_URL: 'https://x.pt/api', ...GOOGLE }), /origin only/);
  assert.equal(loadOidcConfig({ ...BASE, ...GOOGLE }).apiPublicUrl, 'https://laprizza.example.pt');
});

test('Microsoft tenant: required; common/organizations rejected', () => {
  const noTenant = { ...MS };
  delete noTenant.MICROSOFT_TENANT;
  assert.throws(() => loadOidcConfig({ ...BASE, ...noTenant }), /MICROSOFT_TENANT is required/);
  for (const t of ['common', 'Organizations']) {
    assert.throws(() => loadOidcConfig({ ...BASE, ...MS, MICROSOFT_TENANT: t }), /cannot be validated/);
  }
});

test('invalid TTL falls back to 10 minutes', () => {
  assert.equal(loadOidcConfig({ OIDC_TRANSACTION_TTL_MINUTES: '0' }).transactionTtlMs, 600_000);
  assert.equal(loadOidcConfig({ OIDC_TRANSACTION_TTL_MINUTES: '5' }).transactionTtlMs, 300_000);
});
