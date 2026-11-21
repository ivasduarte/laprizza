import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  activationStep,
  externalActivationForm,
  providerLabel,
  readActivationToken,
  submitForm,
} from '../../../src/shared/auth/account-activation.js';
import { parseCallbackParams } from '../../../src/shared/auth/external-auth.js';
import { KNOWN_AUTH_ERRORS } from '../../../src/shared/auth/auth-error.js';
import { LANGUAGES } from '../../../src/shared/i18n/language.js';
import { messages } from '../../../src/shared/i18n/message.js';

const TOKEN = 'Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE';

describe('readActivationToken (AA07)', () => {
  it('reads the token from the link fragment', () => {
    assert.equal(readActivationToken(`#token=${TOKEN}`), TOKEN);
    assert.equal(readActivationToken(`token=${TOKEN}`), TOKEN);
  });

  it('ignores missing or malformed tokens', () => {
    [
      '',
      '#',
      '#token=',
      '#token=short',
      `#token=${TOKEN}x`,
      '#token=<script>',
      undefined,
    ].forEach((hash) =>
      assert.equal(readActivationToken(hash), null, String(hash))
    );
  });
});

describe('activationStep (AA07)', () => {
  it('local and external steps carry the masked e-mail', () => {
    assert.deepEqual(
      activationStep({ method: 'local', email: 'm***a@laprizza.pt' }),
      {
        step: 'local',
        email: 'm***a@laprizza.pt',
      }
    );
    assert.deepEqual(
      activationStep({
        method: 'external',
        provider: 'google',
        email: 'e***r@gmail.com',
      }),
      { step: 'external', provider: 'google', email: 'e***r@gmail.com' }
    );
  });

  it('never offers a step the back end did not ask for', () => {
    [
      null,
      {},
      { method: 'admin' },
      { method: 'external' },
      { method: 'external', provider: 'https://evil' },
    ].forEach((inspection) =>
      assert.deepEqual(
        activationStep(inspection),
        { step: 'invalid' },
        JSON.stringify(inspection)
      )
    );
  });
});

describe('external activation form (AA07)', () => {
  it('posts the token in the body to /auth/external/activate', () => {
    assert.deepEqual(
      externalActivationForm('http://localhost:3000/api/v2/', TOKEN),
      {
        action: 'http://localhost:3000/api/v2/auth/external/activate',
        method: 'post',
        fields: { token: TOKEN },
      }
    );
  });

  it('refuses malformed tokens (never builds a request with them)', () => {
    ['', 'x', `${TOKEN}?a=1`, undefined].forEach((token) =>
      assert.throws(
        () => externalActivationForm('/api/v2', token),
        /Invalid activation token/
      )
    );
  });

  it('submits a hidden form with the fields (token never in the action URL)', () => {
    const appended = [];
    const form = {
      appendChild: (el) => appended.push(el),
      submit: mock.fn(),
      style: {},
    };
    const doc = {
      createElement: (tag) => (tag === 'form' ? form : {}),
      body: { appendChild: mock.fn() },
    };
    submitForm(externalActivationForm('/api/v2', TOKEN), doc);
    assert.equal(form.method, 'post');
    assert.equal(form.action, '/api/v2/auth/external/activate');
    assert.ok(!form.action.includes(TOKEN));
    assert.deepEqual(appended, [
      { type: 'hidden', name: 'token', value: TOKEN },
    ]);
    assert.equal(form.submit.mock.callCount(), 1);
  });

  it('shows a readable provider name', () => {
    assert.equal(providerLabel('google'), 'Google');
    assert.equal(providerLabel(''), '');
  });
});

describe('external activation result (AA07)', () => {
  it('recognizes status=activated (no session) and the invitation error codes', () => {
    assert.deepEqual(
      parseCallbackParams(new URLSearchParams('status=activated')),
      {
        status: 'activated',
        code: null,
      }
    );
    ['INVITATION_INVALID', 'INVITATION_MISMATCH'].forEach((code) =>
      assert.deepEqual(
        parseCallbackParams(new URLSearchParams(`status=error&code=${code}`)),
        {
          status: 'error',
          code,
        }
      )
    );
  });
});

describe('activation texts (AA07)', () => {
  const lookup = (language, key) =>
    key.split('.').reduce((node, part) => node?.[part], messages[language]);

  it('has every activation text in every language', () => {
    const keys = [
      'nav.activateAccount',
      'activation.title',
      'activation.checking',
      'activation.invalidLink',
      'activation.retry',
      'activation.localIntro',
      'activation.externalIntro',
      'activation.continueWith',
      'activation.submit',
      'activation.noConsent',
      'activation.done',
      'activation.goToLogin',
      'auth.external.activated',
    ];
    LANGUAGES.forEach(({ code: language }) => {
      keys.forEach((key) =>
        assert.ok(lookup(language, key), `${language}:${key}`)
      );
    });
  });

  it('translates the invitation errors returned by the API', () => {
    assert.ok(KNOWN_AUTH_ERRORS.includes('INVITATION_INVALID'));
    assert.ok(KNOWN_AUTH_ERRORS.includes('INVITATION_MISMATCH'));
  });
});
