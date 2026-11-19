import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const GENERATED = join(SRC, 'api');

function sourceFiles(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === GENERATED) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) ? [path] : [];
  });
}

/**
 * WEB03/AA05: the interface decides with permissions granted by the back end, never with
 * role names, so a new role (e.g. ADMINISTRATOR) only needs data on the back end.
 */
const ROLE_CHECKS = [
  /['"](MANAGER|EMPLOYEE|CUSTOMER|ADMINISTRATOR)['"]/,
  /\buser\??\.role\b/,
  /\.roles\??\.(includes|some|indexOf|find)\(/,
];

describe('No role-name checks in the SPA (WEB03)', () => {
  it('no source file decides with role names', () => {
    const offending = sourceFiles().flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => ROLE_CHECKS.some((pattern) => pattern.test(line)))
        .map(
          ({ line, index }) =>
            `${relative(SRC, file)}:${index + 1}  ${line.trim()}`
        )
    );
    assert.deepEqual(
      offending,
      [],
      'use useCan(permission) instead of role names'
    );
  });

  it('the patterns do catch role checks (sanity check)', () => {
    for (const sample of [
      "roles.includes('MANAGER')",
      'user?.role === x',
      'user.roles.some((r) => r)',
    ]) {
      assert.ok(
        ROLE_CHECKS.some((pattern) => pattern.test(sample)),
        sample
      );
    }
  });
});
