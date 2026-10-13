import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyToken, requireRole } from '../../src/api/middleware/auth.middleware.js';

process.env.JWT_SECRET = 'test_secret_key';

/**
 * Creates a dummy Express 'next' function for unit testing middleware.
 * Captures any error passed to it, allowing assertions on the error state without requiring testing libraries like Mockito.
 *
 * @returns {{nextFn: Function, getError: Function}} An object containing the dummy next function and a getter for the captured error.
 */
const createDummyNext = () => {
  let error = null;
  return {
    nextFn: (err) => {
      error = err;
    },
    getError: () => error,
  };
};

/**
 * Unit test: verifyToken middleware.
 * Ensures that a 401 Unauthorized error is thrown if the Authorization header is missing or uses the wrong scheme (e.g., Basic instead of Bearer).
 */
test('verifyToken fails on missing or Basic format', () => {
  const { nextFn, getError } = createDummyNext();

  // Missing header
  verifyToken({ headers: {} }, {}, nextFn);
  assert.equal(getError().status, 401);

  // Basic format
  verifyToken({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }, {}, nextFn);
  assert.equal(getError().status, 401);
});

/**
 * Unit test: verifyToken middleware.
 * Ensures that a 401 Unauthorized error is thrown if the JWT is malformed, lacks a valid signature, or has expired.
 */
test('verifyToken fails on invalid or expired token', () => {
  const { nextFn, getError } = createDummyNext();

  // Invalid
  verifyToken({ headers: { authorization: 'Bearer no_signature_token' } }, {}, nextFn);
  assert.equal(getError().status, 401);

  // Expired
  const expiredToken = jwt.sign({ userId: '1' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  verifyToken({ headers: { authorization: `Bearer ${expiredToken}` } }, {}, nextFn);
  assert.equal(getError().status, 401);
});

/**
 * Unit test: verifyToken middleware.
 * Ensures that a valid token is successfully decoded and its payload is injected into the request object (req.user).
 */
test('verifyToken succeeds and populates req.user', () => {
  let calledWithoutError = false;
  const req = {
    headers: {
      authorization: `Bearer ${jwt.sign({ userId: '123', role: 'MANAGER' }, process.env.JWT_SECRET)}`,
    },
  };

  verifyToken(req, {}, (err) => {
    if (!err) calledWithoutError = true;
  });

  assert.ok(calledWithoutError);
  assert.equal(req.user.userId, '123');
});

/**
 * Unit test: requireRole middleware.
 * Ensures that a user whose role matches one of the allowed roles can proceed to the next middleware.
 */
test('requireRole allows authorized roles', () => {
  let calledWithoutError = false;
  const req = { user: { role: 'MANAGER' } };

  requireRole(['MANAGER', 'EMPLOYEE'])(req, {}, (err) => {
    if (!err) calledWithoutError = true;
  });
  assert.ok(calledWithoutError);
});

/**
 * Unit test: requireRole middleware.
 * Ensures that a 403 Forbidden error is thrown if the user's role is not included in the allowed roles array.
 */
test('requireRole blocks unauthorized roles', () => {
  const { nextFn, getError } = createDummyNext();
  const req = { user: { role: 'CUSTOMER' } };

  requireRole(['MANAGER', 'EMPLOYEE'])(req, {}, nextFn);
  assert.equal(getError().status, 403);
});