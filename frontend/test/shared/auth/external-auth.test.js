import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALLBACK_ERROR_CODES,
  callbackTarget,
  externalLoginUrl,
  parseCallbackParams,
} from '../../../src/shared/auth/external-auth.js';
import { LANGUAGES } from '../../../src/shared/i18n/language.js';
import { messages } from '../../../src/shared/i18n/message.js';
import { features } from '../../../src/features/registry.js';

const params = (query) => new URLSearchParams(query);

describe('externalLoginUrl', () => {
  it('builds the login URL under the API base, ignoring a trailing slash', () => {
    assert.equal(
      externalLoginUrl('http://localhost:3000/api/v2/', 'google'),
      'http://localhost:3000/api/v2/auth/external/google/login'
    );
  });

  it('rejects malformed provider names (no path or query injection)', () => {
    ['', 'Google', '../x', 'google?x=1', 'a/b', undefined].forEach((name) => {
      assert.throws(() => externalLoginUrl('/api/v2', name), /Invalid provider/, String(name));
    });
  });
});

describe('callbackTarget', () => {
  const success = { status: 'success', code: null };

  it('waits while the session is being restored', () => {
    assert.equal(callbackTarget(success, 'loading', null), null);
    assert.equal(callbackTarget(success, 'unknown', null), null);
  });

  it('goes home once authenticated, or to the customer data on a first external login', () => {
    assert.equal(callbackTarget(success, 'authenticated', { phoneRequired: false }), '/');
    // A new customer account: My data asks for the phone first, then for the customer data.
    assert.equal(
      callbackTarget(success, 'authenticated', { phoneRequired: true, customerId: null, permissions: ['catalogue:read'] }),
      '/my-data',
    );
    // Staff without a phone (phone gate) still goes to the phone form.
    assert.equal(
      callbackTarget(success, 'authenticated', { phoneRequired: true, permissions: ['catalogue:read', 'stock:read'] }),
      '/complete-profile',
    );
  });

  it('never leaves an error, an activation or a refused session', () => {
    const authenticated = { phoneRequired: false };
    assert.equal(callbackTarget({ status: 'error', code: 'AUTH_FAILED' }, 'authenticated', authenticated), null);
    assert.equal(callbackTarget({ status: 'activated', code: null }, 'authenticated', authenticated), null);
    assert.equal(callbackTarget(success, 'anonymous', null), null);
  });
});

describe('parseCallbackParams', () => {
  it('recognizes success', () => {
    assert.deepEqual(parseCallbackParams(params('status=success')), { status: 'success', code: null });
  });

  it('returns known error codes', () => {
    CALLBACK_ERROR_CODES.forEach((code) => {
      assert.deepEqual(parseCallbackParams(params(`status=error&code=${code}`)), { status: 'error', code });
    });
  });

  it('turns unknown, missing or forged values into AUTH_FAILED', () => {
    ['', 'status=error', 'status=error&code=<script>', 'status=ok', 'code=ACCESS_DENIED'].forEach((query) => {
      const out = parseCallbackParams(params(query));
      assert.equal(out.status, 'error', query);
      assert.equal(out.code, query === 'code=ACCESS_DENIED' ? 'ACCESS_DENIED' : 'AUTH_FAILED', query);
    });
  });
});

describe('external login texts', () => {
  const lookup = (language, key) => key.split('.').reduce((node, part) => node?.[part], messages[language]);

  it('has a translated message for every callback error code, in every language', () => {
    LANGUAGES.forEach(({ code: language }) => {
      CALLBACK_ERROR_CODES.forEach((code) => {
        assert.ok(lookup(language, `auth.external.errors.${code}`), `${language}:${code}`);
      });
      ['or', 'continueWith', 'completing', 'title'].forEach((key) => {
        assert.ok(lookup(language, `auth.external.${key}`), `${language}:${key}`);
      });
    });
  });

  it('keeps the callback page out of the menu and translated', () => {
    const feature = features.find((f) => f.id === 'auth-callback');
    assert.equal(feature.path, '/auth/callback');
    assert.equal(feature.showInNav, false);
    LANGUAGES.forEach(({ code }) => assert.ok(lookup(code, feature.labelKey), code));
  });
});
