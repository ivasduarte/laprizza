import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../../src/shared/api/http-client.js';
import {
  isAbortError,
  kindOf,
  normalizeDetails,
  normalizeError,
} from '../../../src/shared/api/error-normalizer.js';

describe('kindOf', () => {
  it('maps HTTP statuses and client codes to kinds', () => {
    const cases = [
      [{ status: 400 }, 'validation'],
      [{ status: 401 }, 'unauthenticated'],
      [{ status: 403 }, 'forbidden'],
      [{ status: 404 }, 'notFound'],
      [{ status: 409 }, 'conflict'],
      [{ status: 429 }, 'rateLimited'],
      [{ status: 500 }, 'server'],
      [{ status: 503 }, 'server'],
      [{ status: 0, code: 'NETWORK_ERROR' }, 'network'],
      [{ status: 0, code: 'TIMEOUT' }, 'timeout'],
      [{ status: 418 }, 'unknown'],
      [new Error('boom'), 'unknown'],
    ];
    cases.forEach(([error, kind]) => assert.equal(kindOf(error), kind));
  });
});

describe('normalizeDetails', () => {
  it('splits structured details into field and form errors and drops the technical message', () => {
    const { fieldErrors, formErrors } = normalizeDetails([
      {
        field: 'name',
        type: 'string.min',
        message: '"name" length must be...',
        limit: 3,
      },
      {
        field: 'address.postalCode',
        type: 'string.pattern.base',
        message: 'x',
      },
      { field: '', type: 'object.missing', message: 'y' },
    ]);
    assert.deepEqual(fieldErrors, [
      { field: 'name', type: 'string.min', limit: 3 },
      { field: 'address.postalCode', type: 'string.pattern.base' },
    ]);
    assert.deepEqual(formErrors, [{ field: '', type: 'object.missing' }]);
    assert.equal(JSON.stringify(fieldErrors).includes('length must be'), false);
  });

  it('keeps legacy string details as raw form-level diagnostics', () => {
    const { formErrors } = normalizeDetails([
      '/elements/0/id duplicate element id',
    ]);
    assert.deepEqual(formErrors, [
      {
        field: '',
        type: 'content.invalid',
        raw: '/elements/0/id duplicate element id',
      },
    ]);
  });

  it('ignores missing or malformed details', () => {
    [undefined, null, 'x', {}, [null, 1, {}]].forEach((details) => {
      assert.deepEqual(normalizeDetails(details), {
        fieldErrors: [],
        formErrors: [],
      });
    });
  });
});

describe('normalizeError', () => {
  it('never exposes the raw message and flags global kinds', () => {
    const error = new ApiError(
      'java.lang.NullPointerException at Foo.bar(Foo.java:42)',
      {
        status: 500,
      }
    );
    const normalized = normalizeError(error);
    assert.equal(normalized.kind, 'server');
    assert.equal(normalized.global, true);
    assert.equal(JSON.stringify(normalized).includes('NullPointer'), false);
  });

  it('drops details of non-validation errors (they could carry internals)', () => {
    const normalized = normalizeError(
      new ApiError('x', { status: 500, details: ['at /srv/app/db.js:42'] })
    );
    assert.deepEqual(normalized.formErrors, []);
    assert.deepEqual(normalized.fieldErrors, []);
  });

  it('keeps 4xx form errors inline (not global)', () => {
    ['validation', 'conflict', 'unauthenticated', 'notFound'].forEach(
      (kind) => {
        const status = {
          validation: 400,
          conflict: 409,
          unauthenticated: 401,
          notFound: 404,
        }[kind];
        assert.equal(
          normalizeError(new ApiError('x', { status })).global,
          false,
          kind
        );
      }
    );
    assert.equal(
      normalizeError(new ApiError('x', { status: 403 })).global,
      true
    );
  });

  it('carries code, Retry-After and the unknown-outcome flag', () => {
    const normalized = normalizeError(
      new ApiError('x', {
        status: 0,
        code: 'TIMEOUT',
        retryAfterSeconds: 30,
        outcomeUnknown: true,
      })
    );
    assert.equal(normalized.kind, 'timeout');
    assert.equal(normalized.retryAfterSeconds, 30);
    assert.equal(normalized.outcomeUnknown, true);
  });

  it('recognises abort errors', () => {
    assert.equal(isAbortError(new DOMException('x', 'AbortError')), true);
    assert.equal(isAbortError(new Error('x')), false);
  });
});
