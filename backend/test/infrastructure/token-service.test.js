import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { createTokenService, AccessTokenError } from '../../src/infrastructure/security/token-service.js';

const SECRET = 'test_secret_key';
const service = createTokenService({ jwtSecret: SECRET, accessTokenTtlSeconds: 3600 });
const PAYLOAD = { userId: 'abcdef000000000000000001', sessionId: 'bbbbbb000000000000000001', tokenVersion: 2 };

/** Asserts that verifyAccessToken fails with the given reason. */
function assertRejected(token, reason, tokenService = service) {
  assert.throws(
    () => tokenService.verifyAccessToken(token),
    (err) => err instanceof AccessTokenError && err.reason === reason,
  );
}

/**
 * Unit test: signAccessToken.
 * The JWT only carries the minimal claims (sub, sid, tv, jti, iat, exp, iss); never the role.
 */
test('signAccessToken issues a JWT with the minimal claims and 1 hour expiry', () => {
  const claims = jwt.decode(service.signAccessToken(PAYLOAD));

  assert.equal(claims.sub, PAYLOAD.userId);
  assert.equal(claims.sid, PAYLOAD.sessionId);
  assert.equal(claims.tv, 2);
  assert.ok(claims.jti);
  assert.equal(claims.iss, 'laprizza-api');
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(claims.role, undefined);
  assert.equal(claims.userId, undefined);
});

/**
 * Unit test: each token has a unique jti.
 */
test('signAccessToken generates a different jti for each token', () => {
  const a = jwt.decode(service.signAccessToken(PAYLOAD));
  const b = jwt.decode(service.signAccessToken(PAYLOAD));
  assert.notEqual(a.jti, b.jti);
});

/**
 * Unit test: verifyAccessToken accepts a valid token.
 */
test('verifyAccessToken returns the claims of a valid token', () => {
  const claims = service.verifyAccessToken(service.signAccessToken(PAYLOAD));
  assert.equal(claims.sub, PAYLOAD.userId);
  assert.equal(claims.sid, PAYLOAD.sessionId);
});

/**
 * Unit test: expired token -> reason EXPIRED (the API answers TOKEN_EXPIRED).
 */
test('verifyAccessToken flags expired tokens', () => {
  const expiredService = createTokenService({ jwtSecret: SECRET, accessTokenTtlSeconds: -1 });
  assertRejected(expiredService.signAccessToken(PAYLOAD), 'EXPIRED');
});

/**
 * Unit test: invalid signature, malformed token, other issuer, algorithm 'none'.
 */
test('verifyAccessToken rejects tampered or foreign tokens', () => {
  const otherSecret = createTokenService({ jwtSecret: 'another_secret', accessTokenTtlSeconds: 3600 });
  assertRejected(otherSecret.signAccessToken(PAYLOAD), 'INVALID');
  assertRejected('not.a.jwt', 'INVALID');

  const otherIssuer = jwt.sign({ sid: 's', tv: 0 }, SECRET, { subject: 'u', issuer: 'someone-else' });
  assertRejected(otherIssuer, 'INVALID');

  const unsigned = jwt.sign({ sid: 's', tv: 0 }, null, { algorithm: 'none', subject: 'u', issuer: 'laprizza-api' });
  assertRejected(unsigned, 'INVALID');
});

/**
 * Unit test: correctly signed tokens without sid/tv (e.g. the old Sprint 1 format) are rejected.
 */
test('verifyAccessToken rejects tokens without the required claims', () => {
  const legacy = jwt.sign({ userId: 'u', role: 'MANAGER' }, SECRET, { issuer: 'laprizza-api' });
  assertRejected(legacy, 'INVALID');

  const noTokenVersion = jwt.sign({ sid: 's' }, SECRET, { subject: 'u', issuer: 'laprizza-api' });
  assertRejected(noTokenVersion, 'INVALID');
});

/**
 * Unit test: opaque tokens (refresh/reset) are 32 random bytes in base64url.
 */
test('generateOpaqueToken returns 43 base64url characters and is random', () => {
  const a = service.generateOpaqueToken();
  const b = service.generateOpaqueToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

/**
 * Unit test: hashOpaqueToken is a deterministic SHA-256 (hex) and different from the token.
 */
test('hashOpaqueToken is a deterministic SHA-256 hex digest', () => {
  const token = service.generateOpaqueToken();
  const hash = service.hashOpaqueToken(token);

  assert.equal(hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(hash, service.hashOpaqueToken(token));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
});
