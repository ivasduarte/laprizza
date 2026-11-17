import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { apiDeprecation } from '../../src/api/middleware/api-deprecation.js';

function createResponse() {
  return { set: mock.fn(), append: mock.fn() };
}

/**
 * Unit test: a deprecated version gets the Deprecation and successor Link headers.
 */
test('apiDeprecation(v1) adds Deprecation and successor-version Link headers', () => {
  const res = createResponse();
  const next = mock.fn();

  apiDeprecation('v1')({ url: '/products?page=2' }, res, next);

  assert.deepEqual(res.set.mock.calls[0].arguments, [
    'Deprecation',
    `@${Date.parse('2026-11-17T00:00:00Z') / 1000}`,
  ]);
  assert.deepEqual(res.append.mock.calls[0].arguments, [
    'Link',
    '</api/v2/products?page=2>; rel="successor-version"',
  ]);
  assert.equal(next.mock.callCount(), 1);
});

/**
 * Unit test: the current version gets no extra headers.
 */
test('apiDeprecation(v2) is a no-op', () => {
  const res = createResponse();
  const next = mock.fn();

  apiDeprecation('v2')({ url: '/products' }, res, next);

  assert.equal(res.set.mock.callCount(), 0);
  assert.equal(res.append.mock.callCount(), 0);
  assert.equal(next.mock.callCount(), 1);
});

/**
 * Unit test: an unknown version never breaks the request.
 */
test('apiDeprecation(unknown) is a no-op', () => {
  const next = mock.fn();
  apiDeprecation('v9')({ url: '/' }, createResponse(), next);
  assert.equal(next.mock.callCount(), 1);
});
