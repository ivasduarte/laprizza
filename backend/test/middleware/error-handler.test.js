import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../../src/api/middleware/error-handler.js';
import { AppError } from '../../src/application/app-error.js';
import { AuthErrorCode, tooManyAttempts } from '../../src/application/auth/auth-errors.js';

/** Fake Express response that records status, headers and body. */
function createDummyResponse() {
  return {
    statusCode: undefined,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

/** Runs the errorHandler and returns the response. */
function handle(err) {
  const res = createDummyResponse();
  errorHandler(err, {}, res, () => {});
  return res;
}

/**
 * Unit test: AppError with its own code -> that code in the response (WEB02: the SPA translates by code).
 */
test('errorHandler uses the AppError code when present', () => {
  const res = handle(new AppError('Invalid credentials.', 401, null, AuthErrorCode.INVALID_CREDENTIALS));
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' },
  });
});

/**
 * Unit test: no code -> derived from the HTTP status (Sprint 1 compatibility).
 */
test('errorHandler derives the code from the status when there is none', () => {
  const res = handle(new AppError('User not found.', 404));
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

/**
 * Unit test: numeric codes (e.g. MongoDB 11000) are never exposed as the code.
 */
test('errorHandler ignores numeric error codes', () => {
  const err = new AppError('Conflict', 409);
  err.code = 11000;
  assert.equal(handle(err).body.error.code, 'CONFLICT');
});

/**
 * Unit test: 429 errors send the Retry-After header.
 */
test('errorHandler sets Retry-After for rate-limited errors', () => {
  const res = handle(tooManyAttempts(AuthErrorCode.TOO_MANY_ATTEMPTS, 60_000));
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['retry-after'], '60');
  assert.equal(res.body.error.code, 'TOO_MANY_ATTEMPTS');
});

/**
 * Unit test (confidentiality): malformed JSON never echoes the body (which may contain a password).
 */
test('errorHandler hides the body excerpt of malformed JSON', () => {
  const parseError = new SyntaxError('Unexpected token, "{"password":Segredo123!" is not valid JSON');
  parseError.type = 'entity.parse.failed';
  parseError.status = 400;
  parseError.expose = true;

  const res = handle(parseError);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'MALFORMED_JSON');
  assert.ok(!JSON.stringify(res.body).includes('Segredo123!'));
});

/**
 * Unit test: 5xx errors hide the internal message and code.
 */
test('errorHandler hides internal details of server errors', (t) => {
  t.mock.method(console, 'error', () => {});
  const err = new Error('connection string mongodb://user:pass@host');
  err.code = 'SECRET_INTERNAL';

  const res = handle(err);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(res.body.error.message, 'Internal Server Error');
});
