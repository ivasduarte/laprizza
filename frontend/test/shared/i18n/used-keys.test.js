import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES } from '../../../src/shared/i18n/language.js';
import { messages } from '../../../src/shared/i18n/message.js';

const SRC = fileURLToPath(new URL('../../../src/', import.meta.url));
const GENERATED = join(SRC, 'api');

/** Every .js/.jsx source file, except the generated API client. */
function sourceFiles(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === GENERATED) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) ? [path] : [];
  });
}

const lookup = (language, key) =>
  key.split('.').reduce((node, part) => node?.[part], messages[language]);

/** A key exists as a plain text or as plural forms (key_one / key_other, used with { count }). */
const exists = (language, key) =>
  typeof lookup(language, key) === 'string' ||
  typeof lookup(language, `${key}_other`) === 'string';

/** Literal keys passed to t('...') in the source code. */
const usedKeys = sourceFiles().flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map(
    ([, key]) => ({ key, file: relative(SRC, file) })
  )
);

describe('Translation keys used in the code', () => {
  it('finds the keys used by the pages (sanity check)', () => {
    assert.ok(usedKeys.some(({ key }) => key === 'access.deniedTitle'));
  });

  it('every key used with t() exists as a text in every language', () => {
    const missing = usedKeys.flatMap(({ key, file }) =>
      LANGUAGES.filter(({ code }) => !exists(code, key)).map(
        ({ code }) => `${code}: ${key} (${file})`
      )
    );
    assert.deepEqual(missing, []);
  });

  it('the kitchen viewer texts are translated (no English default text in Portuguese)', () => {
    for (const key of [
      'kitchenConfig.viewer.empty',
      'kitchenConfig.viewer.showing',
    ]) {
      for (const { code } of LANGUAGES)
        assert.ok(exists(code, key), `${code}: ${key}`);
    }
  });

  it('the access-denied and not-found texts exist (WEB03)', () => {
    for (const key of [
      'access.deniedTitle',
      'access.deniedMessage',
      'access.notFoundTitle',
      'access.notFoundMessage',
      'access.goHome',
    ]) {
      for (const { code } of LANGUAGES) {
        assert.equal(typeof lookup(code, key), 'string', `${code}: ${key}`);
      }
    }
  });
});
