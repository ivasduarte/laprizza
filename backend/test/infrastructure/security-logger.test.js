import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecurityLogger } from '../../src/infrastructure/logging/security-logger.js';

/** Creates a logger that writes to an array. */
function createCapturingLogger(options = {}) {
  const lines = [];
  const logger = createSecurityLogger({ ...options, write: (line) => lines.push(JSON.parse(line)) });
  return { logger, lines };
}

/**
 * Unit test: each event is one JSON line with timestamp, type and event.
 */
test('log writes a structured JSON line', () => {
  const { logger, lines } = createCapturingLogger();
  logger.log('LOGIN_FAILED', { email: 'a@b.pt', ip: '127.0.0.1', reason: 'INVALID_PASSWORD' });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].type, 'SECURITY');
  assert.equal(lines[0].event, 'LOGIN_FAILED');
  assert.equal(lines[0].email, 'a@b.pt');
  assert.equal(lines[0].reason, 'INVALID_PASSWORD');
  assert.ok(!Number.isNaN(Date.parse(lines[0].timestamp)));
});

/**
 * Unit test (AA05): passwords, tokens, cookies and hashes are never logged,
 * even when passed by mistake.
 */
test('log drops sensitive keys', () => {
  const { logger, lines } = createCapturingLogger();
  logger.log('TEST', {
    password: 'secret',
    newPassword: 'secret',
    accessToken: 'abc',
    refreshToken: 'abc',
    authorization: 'Bearer abc',
    cookie: 'lp_rt=abc',
    passwordHash: '$argon2id$...',
    userId: 'u1',
  });

  const serialized = JSON.stringify(lines[0]);
  assert.ok(!serialized.includes('secret'));
  assert.ok(!serialized.includes('abc'));
  assert.ok(!serialized.includes('argon2'));
  assert.equal(lines[0].userId, 'u1');
});

/**
 * Unit test: fields with undefined are omitted.
 */
test('log omits undefined fields', () => {
  const { logger, lines } = createCapturingLogger();
  logger.log('TEST', { userId: undefined, ip: '::1' });
  assert.ok(!('userId' in lines[0]));
  assert.equal(lines[0].ip, '::1');
});

/**
 * Unit test: disabled logger (e.g. NODE_ENV=test) writes nothing.
 */
test('disabled logger writes nothing', () => {
  const { logger, lines } = createCapturingLogger({ enabled: false });
  logger.log('TEST', { ip: '::1' });
  assert.equal(lines.length, 0);
});
