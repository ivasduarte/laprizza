import test from 'node:test';
import assert from 'node:assert/strict';
import { externalAuthPaths } from '../../src/api/auth/external-auth.openapi.js';

test('documents the three external-auth endpoints, GET only', () => {
  assert.deepEqual(Object.keys(externalAuthPaths).sort(), [
    '/auth/external/providers',
    '/auth/external/{provider}/callback',
    '/auth/external/{provider}/login',
  ]);
  for (const item of Object.values(externalAuthPaths)) assert.deepEqual(Object.keys(item), ['get']);
});

test('path templates declare their path parameters', () => {
  for (const [path, item] of Object.entries(externalAuthPaths)) {
    const names = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const declared = (item.get.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name);
    assert.deepEqual(declared, names, path);
  }
});

test('login and callback answer with a redirect, never with a token body', () => {
  for (const key of ['/auth/external/{provider}/login', '/auth/external/{provider}/callback']) {
    const res = externalAuthPaths[key].get.responses;
    assert.ok(res[302], key);
    assert.equal(res[302].content, undefined, key);
  }
});
