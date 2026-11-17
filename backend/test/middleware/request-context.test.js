import test from 'node:test';
import assert from 'node:assert/strict';
import { requestContext } from '../../src/api/middleware/request-context.js';

test('requestContext records path, route pattern, method, ip and a truncated user agent only', () => {
  const ctx = requestContext({
    ip: '10.0.0.1',
    method: 'GET',
    baseUrl: '/api/v1/customers',
    path: '/65231abcd345678901234999',
    route: { path: '/:id' },
    headers: {
      'user-agent': 'x'.repeat(500),
      authorization: 'Bearer secret-token',
      cookie: 'lp_rt=secret-refresh',
    },
    query: { search: 'Maria' },
    body: { password: 'secret-password' },
  });

  assert.deepEqual(Object.keys(ctx).sort(), ['ip', 'method', 'path', 'route', 'userAgent']);
  assert.equal(ctx.path, '/api/v1/customers/65231abcd345678901234999'); // which record was requested
  assert.equal(ctx.route, '/api/v1/customers/:id'); // groups attempts on the same resource
  assert.equal(ctx.userAgent.length, 200);
  const serialized = JSON.stringify(ctx);
  assert.ok(!serialized.includes('secret'));
  assert.ok(!serialized.includes('Maria'));
});

test('without a matched route (e.g. before routing) nothing throws and route is omitted', () => {
  const ctx = requestContext({ ip: '::1', method: 'POST', baseUrl: '', path: '/x', headers: {} });
  assert.equal(ctx.path, '/x');
  assert.equal(ctx.route, undefined);
  assert.equal(ctx.userAgent, undefined);
});

test('works with a minimal request object', () => {
  assert.equal(requestContext({}).path, '');
});
