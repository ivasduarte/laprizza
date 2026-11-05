import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp, loadConfig } from '../../src/index.js';
import { loadVersionInfo } from '../../src/infrastructure/system/version-file.reader.js';

/**
 * Integration tests: GET /api/v1/version.
 * VERSION.json is written to a temporary folder, so the tests never read the real
 * back-end root and work the same locally and on the staging VM.
 */
const VERSION = {
  sha: 'd455e69a1b2c3d4e5f60718293a4b5c6d7e8f901',
  shortSha: 'd455e69',
  branch: 'main',
  commitDate: '2026-11-04T18:22:10+00:00',
  deployedAt: '2026-11-05T09:00:03Z',
};

function createTempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'laprizza-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function startServer(t, versionInfo) {
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test_secret' }), {
    databaseHealthProbe: { isHealthy: async () => true },
    versionInfo,
  }).listen(0);

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}/api/v1/version`;
}

test('GET /api/v1/version returns the contents of VERSION.json', async (t) => {
  const file = join(createTempDir(t), 'VERSION.json');
  writeFileSync(file, JSON.stringify({ ...VERSION, extra: 'ignored' }));
  const url = await startServer(t, loadVersionInfo(file));

  const response = await fetch(url);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), VERSION);
});

test('GET /api/v1/version returns unknown when VERSION.json does not exist', async (t) => {
  const missing = join(createTempDir(t), 'VERSION.json');
  const url = await startServer(t, loadVersionInfo(missing));

  const response = await fetch(url);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sha: 'unknown', shortSha: 'unknown' });
});

test('GET /api/v1/version keeps the value read at startup', async (t) => {
  const file = join(createTempDir(t), 'VERSION.json');
  writeFileSync(file, JSON.stringify(VERSION));
  const url = await startServer(t, loadVersionInfo(file));

  writeFileSync(file, JSON.stringify({ ...VERSION, shortSha: 'changed' }));
  const response = await fetch(url);

  assert.equal((await response.json()).shortSha, 'd455e69');
});
