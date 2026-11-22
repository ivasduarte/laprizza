import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { personName, placeName } from '../../../src/shared/forms/validators.js';
import { messages } from '../../../src/shared/i18n/message.js';

describe('Name rules (WEB04)', () => {
  it('accepts real person names, with accents, apostrophes and hyphens', () => {
    for (const name of [
      'Ana Maria',
      'José Saramago',
      "D'Artagnan",
      'Ana-Rita Sá',
      'Zoë Ñúñez',
    ]) {
      assert.equal(personName()(name), null, name);
    }
  });

  it('refuses digits, symbols and separators at the start or end of a name', () => {
    for (const name of [
      'Ana2',
      '1Ana',
      'Ana!',
      '-Ana',
      'Ana-',
      'Ana  Rita',
      'Ana_Rita',
      '@na',
    ]) {
      assert.deepEqual(personName()(name), { type: 'person.name' }, name);
    }
  });

  it('accepts place names with dots and refuses digits', () => {
    assert.equal(placeName()('Sta. Maria da Feira'), null);
    assert.equal(placeName()('Póvoa de Varzim'), null);
    assert.deepEqual(placeName()('Porto 1'), { type: 'place.name' });
  });

  it('has a text for every name violation in both languages', () => {
    for (const language of Object.keys(messages)) {
      const validation = messages[language].feedback.validation;
      for (const key of ['person_name', 'place_name', 'string_pattern_name']) {
        assert.ok(validation[key], `${language}:${key}`);
      }
    }
  });
});
