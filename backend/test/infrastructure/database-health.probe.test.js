import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createMongooseHealthProbe } from '../../src/infrastructure/system/database-health.probe.js';

/**
 * Unit tests for the Mongoose health probe, using a mocked connection object
 * (no real MongoDB). `ping` is a mock so each test controls its answer.
 */
function createConnectionMock({ readyState = 1 } = {}) {
  const ping = mock.fn(async () => ({ ok: 1 }));
  return { ping, connection: { readyState, db: { admin: () => ({ ping }) } } };
}

test('isHealthy is true when connected and the ping answers', async () => {
  const { connection, ping } = createConnectionMock();
  const probe = createMongooseHealthProbe({ connection });
  assert.equal(await probe.isHealthy(), true);
  assert.equal(ping.mock.callCount(), 1);
});

test('isHealthy is false when the connection is not open', async () => {
  const { connection, ping } = createConnectionMock({ readyState: 0 });
  const probe = createMongooseHealthProbe({ connection });

  assert.equal(await probe.isHealthy(), false);
  assert.equal(ping.mock.callCount(), 0);
});

test('isHealthy is false when the ping fails', async () => {
  const { connection, ping } = createConnectionMock();
  ping.mock.mockImplementation(async () => {
    throw new Error('ping failed');
  });
  const probe = createMongooseHealthProbe({ connection });

  assert.equal(await probe.isHealthy(), false);
});

test('isHealthy is false when the ping takes longer than the timeout', async () => {
  const { connection, ping } = createConnectionMock();
  ping.mock.mockImplementation(() => new Promise(() => {}));
  const probe = createMongooseHealthProbe({ connection, timeoutMs: 20 });

  assert.equal(await probe.isHealthy(), false);
});
