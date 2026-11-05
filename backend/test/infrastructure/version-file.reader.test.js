import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_VERSION_FILE,
  loadVersionInfo,
} from '../../src/infrastructure/system/version-file.reader.js';

function createTempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'laprizza-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('DEFAULT_VERSION_FILE points to VERSION.json at the back-end root', () => {
  const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
  assert.equal(DEFAULT_VERSION_FILE, join(backendRoot, 'VERSION.json'));
});

test('loadVersionInfo returns unknown when the file is not valid JSON', (t) => {
  const file = join(createTempDir(t), 'VERSION.json');
  writeFileSync(file, '{ not json');
  t.mock.method(console, 'warn', () => {});

  assert.deepEqual(loadVersionInfo(file), { sha: 'unknown', shortSha: 'unknown' });
});

test('loadVersionInfo uses unknown for a missing sha or shortSha', (t) => {
  const file = join(createTempDir(t), 'VERSION.json');
  writeFileSync(file, JSON.stringify({ branch: 'main' }));

  const info = loadVersionInfo(file);

  assert.equal(info.sha, 'unknown');
  assert.equal(info.shortSha, 'unknown');
  assert.equal(info.branch, 'main');
});
