import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  activateAtomic,
  ACTIVATION_TARGET_NOT_FOUND,
} from '../../src/infrastructure/kitchen-configuration/kitchen-configuration.repository.js';

const TARGET = '6aedb3f6fd330374822b0679';
const PREVIOUS = '6aedb3f6fd330374822b0678';

function fakeModel(overrides = {}) {
  return {
    findOne: mock.fn(async () => ({ _id: PREVIOUS })),
    updateMany: mock.fn(async () => ({ modifiedCount: 1 })),
    updateOne: mock.fn(async () => ({ modifiedCount: 1 })),
    findByIdAndUpdate: mock.fn(async () => ({ _id: TARGET, isActive: true })),
    ...overrides,
  };
}

const silentLogger = () => ({ error: mock.fn() });

test('activates the target after deactivating the current one, without sessions', async () => {
  const model = fakeModel();

  const result = await activateAtomic(TARGET, { model, logger: silentLogger() });

  assert.deepEqual(result, { _id: TARGET, isActive: true });
  assert.deepEqual(model.findOne.mock.calls[0].arguments[0], { isActive: true });
  assert.deepEqual(model.updateMany.mock.calls[0].arguments.slice(0, 2), [
    { isActive: true, _id: { $ne: TARGET } },
    { $set: { isActive: false } },
  ]);
  assert.equal(model.updateMany.mock.calls[0].arguments[2], undefined, 'no session');
  assert.deepEqual(model.findByIdAndUpdate.mock.calls[0].arguments, [
    TARGET,
    { $set: { isActive: true } },
    { returnDocument: 'after' },
  ]);
  assert.equal(model.updateOne.mock.callCount(), 0, 'nothing to restore');
});

test('deactivates before activating (the unique index allows only one active)', async () => {
  const order = [];
  const model = fakeModel({
    updateMany: mock.fn(async () => order.push('deactivate')),
    findByIdAndUpdate: mock.fn(async () => {
      order.push('activate');
      return { _id: TARGET, isActive: true };
    }),
  });

  await activateAtomic(TARGET, { model, logger: silentLogger() });
  assert.deepEqual(order, ['deactivate', 'activate']);
});

test('restores the previous configuration when the target no longer exists', async () => {
  const model = fakeModel({ findByIdAndUpdate: mock.fn(async () => null) });

  await assert.rejects(
    activateAtomic(TARGET, { model, logger: silentLogger() }),
    (err) => err.code === ACTIVATION_TARGET_NOT_FOUND,
  );

  assert.deepEqual(model.updateOne.mock.calls[0].arguments, [
    { _id: PREVIOUS },
    { $set: { isActive: true } },
  ]);
});

test('restores the previous one and rethrows when a concurrent activation wins', async () => {
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

  await assert.rejects(activateAtomic(TARGET, { model, logger }), duplicate); // service -> 409
  assert.equal(model.updateOne.mock.callCount(), 1);
  assert.equal(logger.error.mock.callCount(), 0, 'a lost race is not an error');
});

test('logs when the previous configuration cannot be restored', async () => {
  const model = fakeModel({
    findByIdAndUpdate: mock.fn(async () => null),
    updateOne: mock.fn(async () => {
      throw new Error('connection lost');
    }),
  });
  const logger = silentLogger();

  await assert.rejects(
    activateAtomic(TARGET, { model, logger }),
    (err) => err.code === ACTIVATION_TARGET_NOT_FOUND,
  );
  assert.equal(logger.error.mock.callCount(), 1);
});

test('without a previously active configuration there is nothing to restore', async () => {
  const model = fakeModel({
    findOne: mock.fn(async () => null),
    findByIdAndUpdate: mock.fn(async () => null),
  });

  await assert.rejects(
    activateAtomic(TARGET, { model, logger: silentLogger() }),
    (err) => err.code === ACTIVATION_TARGET_NOT_FOUND,
  );
  assert.equal(model.updateOne.mock.callCount(), 0);
});

test('an invalid id returns null without touching the database', async () => {
  const model = fakeModel();
  assert.equal(await activateAtomic('not-an-id', { model }), null);
  assert.equal(model.findOne.mock.callCount(), 0);
  assert.equal(model.updateMany.mock.callCount(), 0);
});
