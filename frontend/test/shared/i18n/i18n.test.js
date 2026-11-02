import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { i18nOptions } from '../../../src/shared/i18n/i18n-options.js';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
} from '../../../src/shared/i18n/language.js';
import { messages } from '../../../src/shared/i18n/message.js';

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );
}

async function createInstance(language) {
  const instance = i18next.createInstance();
  await instance.init({ ...i18nOptions, lng: language });
  return instance;
}

describe('messages', () => {
  it('has a dictionary for every supported language', () => {
    LANGUAGES.forEach(({ code }) => assert.ok(messages[code], code));
  });

  it('has the same keys in every language', () => {
    const reference = flatten(messages[DEFAULT_LANGUAGE])
      .map(([key]) => key)
      .sort();
    LANGUAGES.forEach(({ code }) => {
      const keys = flatten(messages[code])
        .map(([key]) => key)
        .sort();
      assert.deepEqual(keys, reference, code);
    });
  });

  it('has no empty texts', () => {
    LANGUAGES.forEach(({ code }) => {
      flatten(messages[code]).forEach(([key, text]) => {
        assert.ok(text.trim(), `${code}:${key}`);
      });
    });
  });
});

describe('i18n configuration', () => {
  it('translates into the selected language', async () => {
    const pt = await createInstance('pt');
    const en = await createInstance('en');
    assert.equal(pt.t('nav.home'), 'Início');
    assert.equal(en.t('nav.home'), 'Home');
  });

  it('uses Portuguese for regional variants such as pt-PT', async () => {
    const instance = await createInstance('pt-PT');
    assert.equal(instance.resolvedLanguage, 'pt');
    assert.equal(instance.t('nav.home'), 'Início');
  });

  it('falls back to English for unsupported languages', async () => {
    const instance = await createInstance('fr');
    assert.equal(instance.resolvedLanguage, DEFAULT_LANGUAGE);
    assert.equal(instance.t('nav.home'), 'Home');
  });

  it('returns the key when a text does not exist', async () => {
    const instance = await createInstance('pt');
    assert.equal(instance.t('does.not.exist'), 'does.not.exist');
  });
});
