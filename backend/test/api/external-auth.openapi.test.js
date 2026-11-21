import test from 'node:test';
import assert from 'node:assert/strict';
import { externalAuthPaths } from '../../src/api/auth/external-auth.openapi.js';

const ACTIVATE = '/auth/external/activate';

test('documents the external-auth endpoints: three GET (AA02) and the activation POST (AA07)', () => {
  assert.deepEqual(Object.keys(externalAuthPaths).sort(), [
    ACTIVATE,
    '/auth/external/providers',
    '/auth/external/{provider}/callback',
    '/auth/external/{provider}/login',
  ]);
  for (const [path, item] of Object.entries(externalAuthPaths)) {
    assert.deepEqual(Object.keys(item), [path === ACTIVATE ? 'post' : 'get'], path);
  }
});

test('path templates declare their path parameters', () => {
  for (const [path, item] of Object.entries(externalAuthPaths)) {
    const operation = item.get ?? item.post;
    const names = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const declared = (operation.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name);
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

test('AA07: the activation takes the token in a form body and answers only with a redirect', () => {
  const operation = externalAuthPaths[ACTIVATE].post;
  assert.deepEqual(Object.keys(operation.requestBody.content), [
    'application/x-www-form-urlencoded',
  ]);
  assert.deepEqual(Object.keys(operation.responses), ['303']);
  assert.equal(operation.responses[303].content, undefined);
  assert.equal(operation.parameters, undefined); // the token is never a query parameter
});
