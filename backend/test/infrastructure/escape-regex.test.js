import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex } from '../../src/infrastructure/utils/escape-regex.js';

test('escapeRegex lets special characters be matched literally', () => {
  for (const input of ['+351912345678', '(21) 123', '[abc', 'a*b', 'a.b', 'a\\b']) {
    assert.ok(new RegExp(escapeRegex(input), 'i').test(input), `Should match literally: ${input}`);
  }
  assert.equal(new RegExp(escapeRegex('a.c')).test('abc'), false);
});