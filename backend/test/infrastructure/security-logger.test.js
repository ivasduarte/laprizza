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
  logger.log('TEST', { userId: undefined, reason: 'X' });
  assert.ok(!('userId' in lines[0]));
  assert.equal(lines[0].reason, 'X');
});

/**
 * Unit test: disabled logger (e.g. NODE_ENV=test) writes nothing.
 */
test('disabled logger writes nothing', () => {
  const { logger, lines } = createCapturingLogger({ enabled: false });
  logger.log('TEST', { ip: '::1' });
  assert.equal(lines.length, 0);
});

/**
 * Unit test (AA05): values that look like credentials are redacted, whatever the field name,
 * also inside arrays and nested objects.
 */
test('log redacts credential-like values in any field', () => {
  const { logger, lines } = createCapturingLogger();
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJlLXZhbHVl';

  logger.log('ACCESS_DENIED', {
    reason: `Bearer ${jwt}`,
    detail: jwt,
    previous: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
    attemptedRoles: ['EMPLOYEE', jwt],
    nested: { header: 'Bearer abc.def.ghi' },
    path: '/api/v1/stock/',
    userId: 'u1',
  });

  const [entry] = lines;
  assert.ok(!JSON.stringify(entry).includes(jwt));
  assert.ok(!JSON.stringify(entry).includes('argon2'));
  assert.equal(entry.reason, '[REDACTED]');
  assert.equal(entry.detail, '[REDACTED]');
  assert.equal(entry.previous, '[REDACTED]');
  assert.deepEqual(entry.attemptedRoles, ['EMPLOYEE', '[REDACTED]']);
  assert.deepEqual(entry.nested, { header: '[REDACTED]' });
  assert.equal(entry.path, '/api/v1/stock/');
  assert.equal(entry.userId, 'u1');
});

/**
 * Unit test: ordinary investigation data is kept as is.
 */
test('log keeps ids, paths, routes, emails and user agents', () => {
  const { logger, lines } = createCapturingLogger();
  const details = {
    userId: '65231abcd345678901234567',
    sessionId: 'bbbbbb000000000000000001',
    path: '/api/v1/customers/65231abcd345678901234999',
    route: '/api/v1/customers/:id',
    email: 'maria@laprizza.pt',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    roles: ['CUSTOMER'],
  };

  logger.log('ACCESS_DENIED', details);

  for (const [key, value] of Object.entries(details)) assert.deepEqual(lines[0][key], value, key);
});

/**
 * Unit test (GDP01): no IP address is ever written, at any depth.
 */
test('log never writes IP addresses', () => {
  const { logger, lines } = createCapturingLogger();
  logger.log('LOGIN_FAILED', { ip: '203.0.113.7', meta: { clientIp: '203.0.113.7' }, reason: 'X' });
  assert.ok(!JSON.stringify(lines[0]).includes('203.0.113.7'));
  assert.equal(lines[0].reason, 'X');
});
