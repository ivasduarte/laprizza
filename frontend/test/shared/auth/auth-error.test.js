import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { i18nOptions } from '../../../src/shared/i18n/i18n-options.js';
import { LANGUAGES } from '../../../src/shared/i18n/language.js';
import { messages } from '../../../src/shared/i18n/message.js';
import {
  KNOWN_AUTH_ERRORS,
  authErrorText,
} from '../../../src/shared/auth/auth-error.js';

async function translator(language) {
  const instance = i18next.createInstance();
  await instance.init({ ...i18nOptions, lng: language });
  return instance.t.bind(instance);
}

describe('Authentication error texts', () => {
  it('has a text for every known error code in every language', () => {
    LANGUAGES.forEach(({ code: language }) => {
      KNOWN_AUTH_ERRORS.forEach((code) => {
        assert.ok(messages[language].auth.errors[code], `${language}:${code}`);
      });
    });
  });

  it('translates by the API code', async () => {
    const t = await translator('en');
    assert.equal(
      authErrorText(t, { status: 401, code: 'INVALID_CREDENTIALS' }),
      'Incorrect email or password.'
    );
  });

  it('adds the wait time in minutes (rounded up) for 429 errors', async () => {
    const t = await translator('en');
    assert.equal(
      authErrorText(t, {
        status: 429,
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSeconds: 61,
      }),
      'Too many failed attempts. Try again in 2 min.'
    );
  });

  it('uses NETWORK_ERROR without a response and UNKNOWN_ERROR for unknown codes', async () => {
    const t = await translator('en');
    assert.equal(
      authErrorText(t, { status: 0 }),
      messages.en.auth.errors.NETWORK_ERROR
    );
    assert.equal(
      authErrorText(t, { status: 500, code: 'SOMETHING_ELSE' }),
      messages.en.auth.errors.UNKNOWN_ERROR
    );
  });
});
