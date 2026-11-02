import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';
import { LANGUAGES } from '../../src/shared/i18n/language.js';
import { messages } from '../../src/shared/i18n/message.js';

const lookup = (language, key) =>
  key.split('.').reduce((node, part) => node?.[part], messages[language]);

describe('Feature registry', () => {
  it('has unique ids and paths', () => {
    assert.equal(new Set(features.map((f) => f.id)).size, features.length);
    assert.equal(new Set(features.map((f) => f.path)).size, features.length);
  });

  it('defines absolute paths, label keys and lazy loaders', () => {
    features.forEach((feature) => {
      assert.ok(feature.path.startsWith('/'), feature.id);
      assert.ok(feature.labelKey, feature.id);
      assert.equal(typeof feature.load, 'function', feature.id);
    });
  });

  it('has a translated menu text in every language', () => {
    features.forEach((feature) => {
      LANGUAGES.forEach(({ code }) => {
        assert.ok(lookup(code, feature.labelKey), `${code}:${feature.id}`);
      });
    });
  });
});
