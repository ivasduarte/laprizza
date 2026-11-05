import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMongooseHealthProbe } from '../../src/infrastructure/system/database-health.probe.js';

/**
 * Unit tests for the Mongoose health probe, using a fake connection object
 * (no real MongoDB).
 */
function fakeConnection({ readyState = 1, ping = async () => ({ ok: 1 }) } = {}) {
  return { readyState, db: { admin: () => ({ ping }) } };
}

test('isHealthy is true when connected and the ping answers', async () => {
  const probe = createMongooseHealthProbe({ connection: fakeConnection() });
  assert.equal(await probe.isHealthy(), true);
});

test('isHealthy is false when the connection is not open', async () => {
  let pinged = false;
  const connection = fakeConnection({
    readyState: 0,
    ping: async () => {
      pinged = true;
    },
  });
  const probe = createMongooseHealthProbe({ connection });

  assert.equal(await probe.isHealthy(), false);
  assert.equal(pinged, false);
});

test('isHealthy is false when the ping fails', async () => {
  const connection = fakeConnection({
    ping: async () => {
      throw new Error('ping failed');
    },
  });
  const probe = createMongooseHealthProbe({ connection });

  assert.equal(await probe.isHealthy(), false);
});

test('isHealthy is false when the ping takes longer than the timeout', async () => {
  const connection = fakeConnection({ ping: () => new Promise(() => {}) });
  const probe = createMongooseHealthProbe({ connection, timeoutMs: 20 });

  assert.equal(await probe.isHealthy(), false);
});
