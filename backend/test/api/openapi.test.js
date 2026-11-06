import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApiSpec } from '../../src/api/openapi.js';

test('openapi.json is up to date with openapi.js', () => {
  const committed = JSON.parse(
    readFileSync(new URL('../../src/api/openapi.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(committed, JSON.parse(JSON.stringify(openApiSpec)));
});
