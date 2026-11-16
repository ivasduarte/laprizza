import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFRESH_LOCK_NAME,
  createRefreshLock,
} from '../../../src/shared/auth/refresh-lock.js';
import { createSessionStore } from '../../../src/shared/auth/session-store.js';

const SESSION = { accessToken: 'token-1', user: { id: 'u1', role: 'MANAGER' } };

/** Same contract as navigator.locks.request for one exclusive lock name. */
function createFakeLocks() {
  const requested = [];
  let tail = Promise.resolve();
  return {
    requested,
    request(name, task) {
      requested.push(name);
      const run = tail.then(() => task());
      tail = run.catch(() => {});
      return run;
    },
  };
}

describe('Refresh lock (AA04)', () => {
  it('runs the task directly when Web Locks are unavailable', async () => {
    const runExclusive = createRefreshLock(undefined);
    assert.equal(await runExclusive(async () => 'done'), 'done');
  });

  it('requests the shared lock name and returns the task result', async () => {
    const locks = createFakeLocks();
    const runExclusive = createRefreshLock(locks);

    assert.equal(await runExclusive(async () => 42), 42);
    assert.deepEqual(locks.requested, [REFRESH_LOCK_NAME]);
  });

  it('never lets two tabs refresh at the same time', async () => {
    const locks = createFakeLocks(); // shared by both "tabs"
    const tabA = createSessionStore({ runExclusive: createRefreshLock(locks) });
    const tabB = createSessionStore({ runExclusive: createRefreshLock(locks) });

    let running = 0;
    let maxRunning = 0;
    const fetchSession = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return SESSION;
    };

    const results = await Promise.all([
      tabA.refresh(fetchSession),
      tabB.refresh(fetchSession),
    ]);

    assert.deepEqual(results, [true, true]);
    assert.equal(maxRunning, 1);
  });

  it('releases the lock when a refresh fails', async () => {
    const locks = createFakeLocks();
    const store = createSessionStore({ runExclusive: createRefreshLock(locks) });

    assert.equal(
      await store.refresh(async () => {
        throw new Error('401');
      }),
      false
    );
    assert.equal(await store.refresh(async () => SESSION), true);
    assert.equal(store.getAccessToken(), 'token-1');
  });
});
