import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { i18nOptions } from '../../../src/shared/i18n/i18n-options.js';
import { LANGUAGES } from '../../../src/shared/i18n/language.js';
import {
  errorMessage,
  fieldMessage,
} from '../../../src/shared/api/error-text.js';
import { normalizeError } from '../../../src/shared/api/error-normalizer.js';
import { ApiError } from '../../../src/shared/api/http-client.js';

async function createT(language) {
  const instance = i18next.createInstance();
  await instance.init({ ...i18nOptions, lng: language });
  return instance.t.bind(instance);
}

/** Joi types the back end can emit for the current schemas. */
const JOI_TYPES = [
  'any.required',
  'string.empty',
  'string.base',
  'string.min',
  'string.max',
  'string.length',
  'string.email',
  'string.pattern.base',
  'string.hex',
  'number.base',
  'number.integer',
  'number.min',
  'number.max',
  'number.positive',
  'array.min',
  'array.max',
  'array.unique',
  'any.only',
  'any.invalid',
  'object.unknown',
  'boolean.base',
  'date.base',
];

describe('fieldMessage', () => {
  it('translates length rules with their limit (PT)', async () => {
    const t = await createT('pt');
    assert.equal(
      fieldMessage(t, { type: 'string.min', limit: 3 }),
      'Use pelo menos 3 caracteres.'
    );
    assert.equal(
      fieldMessage(t, { type: 'any.required' }),
      'Este campo é obrigatório.'
    );
  });

  it('translates length rules with their limit (EN)', async () => {
    const t = await createT('en');
    assert.equal(
      fieldMessage(t, { type: 'string.min', limit: 3 }),
      'Use at least 3 characters.'
    );
  });

  it('has a specific text, with no leftover placeholder, for every known Joi type in every language', async () => {
    for (const { code } of LANGUAGES) {
      const t = await createT(code);
      const generic = fieldMessage(t, { type: 'unknown.type' });
      for (const type of JOI_TYPES) {
        const text = fieldMessage(t, { type, limit: 5 });
        assert.ok(
          text && !text.includes('{{') && !text.includes('feedback.'),
          `${code}:${type}`
        );
        if (type !== 'any.invalid')
          assert.notEqual(
            text,
            generic,
            `${code}:${type} falls back to generic`
          );
      }
    }
  });

  it('falls back to a generic text for unknown types and shows legacy raw diagnostics', async () => {
    const t = await createT('en');
    assert.equal(
      fieldMessage(t, { type: 'something.new' }),
      'The value is invalid.'
    );
    assert.equal(
      fieldMessage(t, {
        type: 'content.invalid',
        raw: '/elements/0/id duplicate',
      }),
      '/elements/0/id duplicate'
    );
  });
});

describe('errorMessage', () => {
  it('uses the auth text for auth codes and the kind text otherwise', async () => {
    const t = await createT('en');
    const login = normalizeError(
      new ApiError('x', { status: 401, code: 'INVALID_CREDENTIALS' })
    );
    assert.equal(errorMessage(t, login), 'Incorrect email or password.');
    const server = normalizeError(
      new ApiError('stack trace here', { status: 500 })
    );
    assert.equal(errorMessage(t, server), t('feedback.errors.server'));
    assert.equal(errorMessage(t, server).includes('stack'), false);
  });

  it('warns that a timed-out write may have been executed', async () => {
    const t = await createT('pt');
    const text = errorMessage(
      t,
      normalizeError(
        new ApiError('x', { status: 0, code: 'TIMEOUT', outcomeUnknown: true })
      )
    );
    assert.ok(text.includes('pode ter sido concluída'));
  });

  it('appends the Retry-After wait', async () => {
    const t = await createT('en');
    const text = errorMessage(
      t,
      normalizeError(
        new ApiError('x', {
          status: 429,
          code: 'TOO_MANY_ATTEMPTS',
          retryAfterSeconds: 120,
        })
      )
    );
    assert.ok(text.includes('2 min'));
  });

  it('has a text for every kind in every language', async () => {
    const kinds = [
      'validation',
      'unauthenticated',
      'forbidden',
      'notFound',
      'conflict',
      'rateLimited',
      'network',
      'timeout',
      'server',
      'unknown',
    ];
    for (const { code } of LANGUAGES) {
      const t = await createT(code);
      kinds.forEach((kind) =>
        assert.notEqual(
          t(`feedback.errors.${kind}`),
          `feedback.errors.${kind}`,
          `${code}:${kind}`
        )
      );
    }
  });
});
