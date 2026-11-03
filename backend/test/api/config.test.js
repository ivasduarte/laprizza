import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/index.js';

/**
 * Unit test: JWT_SECRET is mandatory.
 */
test('loadConfig requires JWT_SECRET', () => {
  assert.throws(() => loadConfig({}), /JWT_SECRET/);
});

/**
 * Unit test: defaults match the decisions (1 h, 7 days, 10/15 min, 3/h, 1-5-30 min, 30 min).
 */
test('loadConfig applies the AA01 defaults', () => {
  const config = loadConfig({ JWT_SECRET: 'x' });

  assert.equal(config.auth.accessTokenTtlSeconds, 3600);
  assert.equal(config.auth.refreshTokenTtlMs, 7 * 24 * 60 * 60 * 1000);
  assert.equal(config.auth.lockoutThreshold, 3);
  assert.deepEqual(config.auth.lockoutStepsMs, [60_000, 300_000, 1_800_000]);
  assert.equal(config.auth.passwordResetTtlMs, 30 * 60 * 1000);
  assert.equal(config.auth.passwordResetUrl, 'http://localhost:4200/reset-password');

  assert.equal(config.rateLimit.enabled, true);
  assert.equal(config.rateLimit.authMax, 10);
  assert.equal(config.rateLimit.authWindowMs, 15 * 60 * 1000);
  assert.equal(config.rateLimit.forgotMax, 3);
  assert.equal(config.rateLimit.forgotWindowMs, 60 * 60 * 1000);

  assert.deepEqual(config.cookie, { name: 'lp_rt', secure: true, sameSite: 'strict', path: '/api/v1/auth' });
  assert.deepEqual(config.corsOrigins, ['http://localhost:4200']);
  assert.equal(config.trustProxy, false);
  assert.equal(config.mail.port, 1025);
});

/**
 * Unit test: in NODE_ENV=test the limits are disabled by default (they can be turned on explicitly).
 */
test('loadConfig disables rate limiting in test unless enabled explicitly', () => {
  assert.equal(loadConfig({ JWT_SECRET: 'x', NODE_ENV: 'test' }).rateLimit.enabled, false);
  assert.equal(
    loadConfig({ JWT_SECRET: 'x', NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'true' }).rateLimit.enabled,
    true,
  );
});

/**
 * Unit test: values configurable through environment variables.
 */
test('loadConfig reads overrides from the environment', () => {
  const config = loadConfig({
    JWT_SECRET: 'x',
    CORS_ORIGIN: 'http://localhost:4200 , https://laprizza.example.pt',
    APP_BASE_URL: 'https://laprizza.example.pt/',
    LOGIN_LOCKOUT_STEPS_SECONDS: '30,120',
    AUTH_RATE_LIMIT_MAX: '100',
    REFRESH_COOKIE_SAMESITE: 'Lax',
  });

  assert.deepEqual(config.corsOrigins, ['http://localhost:4200', 'https://laprizza.example.pt']);
  assert.equal(config.auth.passwordResetUrl, 'https://laprizza.example.pt/reset-password');
  assert.deepEqual(config.auth.lockoutStepsMs, [30_000, 120_000]);
  assert.equal(config.rateLimit.authMax, 100);
  assert.equal(config.cookie.sameSite, 'lax');
});

/**
 * Unit test: SameSite=None without Secure is rejected (browsers would ignore the cookie).
 */
test('loadConfig rejects SameSite=None without Secure', () => {
  assert.throws(
    () => loadConfig({ JWT_SECRET: 'x', REFRESH_COOKIE_SAMESITE: 'none', REFRESH_COOKIE_SECURE: 'false' }),
    /REFRESH_COOKIE_SECURE/,
  );
});

/**
 * Unit test: TRUST_PROXY accepts false/true, a number of hops or an Express value.
 */
test('loadConfig parses TRUST_PROXY', () => {
  const trustProxy = (value) => loadConfig({ JWT_SECRET: 'x', TRUST_PROXY: value }).trustProxy;
  assert.equal(trustProxy(undefined), false);
  assert.equal(trustProxy('false'), false);
  assert.equal(trustProxy('true'), true);
  assert.equal(trustProxy('1'), 1);
  assert.equal(trustProxy('loopback'), 'loopback');
});
