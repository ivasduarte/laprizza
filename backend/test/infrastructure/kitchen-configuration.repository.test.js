import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  activateAtomic,
  isTransactionUnsupported,
  resetActivationFallbackWarning,
  ACTIVATION_TARGET_NOT_FOUND,
} from '../../src/infrastructure/kitchen-configuration/kitchen-configuration.repository.js';

const TARGET = '6aedb3f6fd330374822b0679';
const PREVIOUS = '6aedb3f6fd330374822b0678';

const unsupported = () =>
  Object.assign(
    new Error('Transaction numbers are only allowed on a replica set member or mongos'),
    { code: 20, codeName: 'IllegalOperation' },
  );

function fakeModel(overrides = {}) {
  return {
    findOne: mock.fn(async () => ({ _id: PREVIOUS })),
    updateMany: mock.fn(async () => ({ modifiedCount: 1 })),
    updateOne: mock.fn(async () => ({ modifiedCount: 1 })),
    findByIdAndUpdate: mock.fn(async () => ({ _id: TARGET, isActive: true })),
    ...overrides,
  };
}

const sessionThat = (withTransaction) => ({
  withTransaction: mock.fn(withTransaction),
  endSession: mock.fn(async () => {}),
});

const silentLogger = () => ({ warn: mock.fn(), error: mock.fn() });

beforeEach(() => resetActivationFallbackWarning());

test('isTransactionUnsupported recognises the standalone server error', () => {
  assert.equal(isTransactionUnsupported(unsupported()), true);
  assert.equal(isTransactionUnsupported({ code: 11000 }), false);
  assert.equal(isTransactionUnsupported(undefined), false);
});

test('uses the transaction when the server supports it', async () => {
  const model = fakeModel();
  const session = sessionThat(async (fn) => fn());
  const logger = silentLogger();

  const result = await activateAtomic(TARGET, {
    model,
    startSession: async () => session,
    logger,
  });

  assert.deepEqual(result, { _id: TARGET, isActive: true });
  assert.equal(session.withTransaction.mock.callCount(), 1);
  assert.equal(session.endSession.mock.callCount(), 1);
  assert.equal(model.findOne.mock.callCount(), 0, 'no fallback');
  assert.ok(model.updateMany.mock.calls[0].arguments[2].session, 'writes run in the session');
  assert.equal(logger.warn.mock.callCount(), 0);
});

test('falls back to the sequential activation on a standalone server', async () => {
  const model = fakeModel();
  const logger = silentLogger();
  const session = sessionThat(async () => {
    throw unsupported();
  });

  const result = await activateAtomic(TARGET, {
    model,
    startSession: async () => session,
    logger,
  });

  assert.deepEqual(result, { _id: TARGET, isActive: true });
  assert.equal(session.endSession.mock.callCount(), 1, 'the session is always closed');
  // previous active remembered, then deactivated (except the target), then the target activated
  assert.deepEqual(model.findOne.mock.calls[0].arguments[0], { isActive: true });
  assert.deepEqual(model.updateMany.mock.calls[0].arguments[0], {
    isActive: true,
    _id: { $ne: TARGET },
  });
  assert.equal(model.updateMany.mock.calls[0].arguments[2], undefined, 'no session');
  assert.equal(model.findByIdAndUpdate.mock.calls[0].arguments[0], TARGET);
  assert.equal(model.updateOne.mock.callCount(), 0, 'nothing to restore');
  assert.equal(logger.warn.mock.callCount(), 1);
});

test('the fallback warning is logged only once', async () => {
  const logger = silentLogger();
  const deps = () => ({
    model: fakeModel(),
    startSession: async () =>
      sessionThat(async () => {
        throw unsupported();
      }),
    logger,
  });

  await activateAtomic(TARGET, deps());
  await activateAtomic(TARGET, deps());
  assert.equal(logger.warn.mock.callCount(), 1);
});

test('fallback: restores the previous configuration when the target no longer exists', async () => {
  const model = fakeModel({ findByIdAndUpdate: mock.fn(async () => null) });

  await assert.rejects(
    activateAtomic(TARGET, {
      model,
      startSession: async () =>
        sessionThat(async () => {
          throw unsupported();
        }),
      logger: silentLogger(),
    }),
    (err) => err.code === ACTIVATION_TARGET_NOT_FOUND,
  );

  assert.equal(model.updateOne.mock.callCount(), 1);
  assert.deepEqual(model.updateOne.mock.calls[0].arguments, [
    { _id: PREVIOUS },
    { $set: { isActive: true } },
  ]);
});

test('fallback: restores the previous one and rethrows when another activation wins', async () => {
  const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  const model = fakeModel({
    findByIdAndUpdate: mock.fn(async () => {
      throw duplicate;
    }),
    // the winner is already active, so the restore also hits the unique index
    updateOne: mock.fn(async () => {
      throw duplicate;
    }),
  });
  const logger = silentLogger();

  await assert.rejects(
    activateAtomic(TARGET, {
      model,
      startSession: async () =>
        sessionThat(async () => {
          throw unsupported();
        }),
      logger,
    }),
    duplicate, // the service maps 11000 to 409
  );

  assert.equal(model.updateOne.mock.callCount(), 1);
  assert.equal(logger.error.mock.callCount(), 0, 'a lost race is not an error');
});

test('fallback without a previously active configuration has nothing to restore', async () => {
  const model = fakeModel({
    findOne: mock.fn(async () => null),
    findByIdAndUpdate: mock.fn(async () => null),
  });

  await assert.rejects(
    activateAtomic(TARGET, {
      model,
      startSession: async () =>
        sessionThat(async () => {
          throw unsupported();
        }),
      logger: silentLogger(),
    }),
    (err) => err.code === ACTIVATION_TARGET_NOT_FOUND,
  );
  assert.equal(model.updateOne.mock.callCount(), 0);
});

test('other transaction errors are not swallowed by the fallback', async () => {
  const conflict = Object.assign(new Error('WriteConflict'), { code: 112 });
  const model = fakeModel();

  await assert.rejects(
    activateAtomic(TARGET, {
      model,
      startSession: async () =>
        sessionThat(async () => {
          throw conflict;
        }),
      logger: silentLogger(),
    }),
    conflict,
  );
  assert.equal(model.findOne.mock.callCount(), 0, 'no fallback');
});

test('an invalid id returns null without touching the database', async () => {
  const startSession = mock.fn();
  assert.equal(await activateAtomic('not-an-id', { model: fakeModel(), startSession }), null);
  assert.equal(startSession.mock.callCount(), 0);
});
