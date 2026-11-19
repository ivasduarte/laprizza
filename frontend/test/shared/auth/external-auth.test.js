import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALLBACK_ERROR_CODES,
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
