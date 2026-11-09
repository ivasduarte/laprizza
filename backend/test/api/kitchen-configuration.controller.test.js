import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as controller from '../../src/api/kitchen-configuration/kitchen-configuration.controller.js';

/** Mocked Express response: status, json and send are chainable mocks. */
function createResponseMock() {
  const res = {};
  res.status = mock.fn(() => res);
  res.json = mock.fn(() => res);
  res.send = mock.fn(() => res);
  return res;
}

/** Status code sent through the mocked response. */
const statusOf = (res) => res.status.mock.calls.at(-1).arguments[0];

/** Body sent through the mocked response. */
const bodyOf = (res) => res.json.mock.calls.at(-1).arguments[0];

test('KitchenConfig Controller: getActive returns 200 and the active config', async () => {
  const req = {};
  const res = createResponseMock();
  const next = mock.fn();

  // Fazemos mock ao repositório, que o controller injeta no serviço
  const mockRepo = {
    getActive: mock.fn(async () => ({ _id: '1', name: 'Active', content: {}, isActive: true })),
  };

  await controller.getActive(req, res, next, mockRepo);
  assert.equal(mockRepo.getActive.mock.callCount(), 1);
  assert.equal(next.mock.callCount(), 0);
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).isActive, true);
  assert.equal(bodyOf(res).id, '1');
});

test('KitchenConfig Controller: activate returns 200', async () => {
  const req = { params: { id: '123' } };
  const res = createResponseMock();
  const next = mock.fn();

  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '123', isActive: false })),
    activateAtomic: mock.fn(async () => ({ _id: '123', isActive: true })),
  };

  await controller.activate(req, res, next, mockRepo);
  assert.equal(mockRepo.findById.mock.calls[0].arguments[0], '123');
  assert.equal(mockRepo.activateAtomic.mock.callCount(), 1);
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).isActive, true);
});

test('KitchenConfig Controller: catches errors and calls next', async () => {
  const req = { params: { id: '123' } };
  const res = createResponseMock();
  const next = mock.fn();

  const mockRepo = {
    // Forçar um erro no repositório para testar se o controller o apanha e passa ao "next"
    findById: mock.fn(async () => {
      throw new Error('Database error');
    }),
  };

  await controller.remove(req, res, next, mockRepo);
  assert.equal(next.mock.callCount(), 1);
  const errorReceived = next.mock.calls[0].arguments[0];
  assert.ok(errorReceived);
  assert.equal(errorReceived.message, 'Database error');
  assert.equal(res.status.mock.callCount(), 0);
});

test('KitchenConfig Controller: list returns 200 and array of configs', async () => {
  const req = {};
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    list: mock.fn(async () => [{ _id: '1', name: 'Standard', content: {}, isActive: false }]),
  };

  await controller.list(req, res, next, mockRepo);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).length, 1);
  assert.equal(bodyOf(res)[0].id, '1');
});

test('KitchenConfig Controller: create returns 201 and new config', async () => {
  const req = {
    body: {
      name: 'New Layout',
      content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] },
    },
  };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = { create: mock.fn(async (data) => ({ _id: '2', ...data })) };

  await controller.create(req, res, next, mockRepo);

  assert.equal(mockRepo.create.mock.calls[0].arguments[0].name, 'New Layout');
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).name, 'New Layout');
  assert.equal(bodyOf(res).id, '2');
});

test('KitchenConfig Controller: validate returns 200 and valid result for correct JSON', async () => {
  const req = {
    body: { content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] } },
  };
  const res = createResponseMock();
  const next = mock.fn();

  await controller.validate(req, res, next);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).valid, true);
});

test('KitchenConfig Controller: getById returns 200 and the requested config', async () => {
  const req = { params: { id: '1' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '1', name: 'Layout', isActive: false })),
  };

  await controller.getById(req, res, next, mockRepo);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).id, '1');
});

test('KitchenConfig Controller: update returns 200 and the updated config', async () => {
  const req = { params: { id: '1' }, body: { name: 'Updated Layout' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({
      _id: '1',
      name: 'Old Layout',
      content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] },
    })),
    update: mock.fn(async (id, data) => ({ _id: id, ...data })),
  };

  await controller.update(req, res, next, mockRepo);

  assert.equal(mockRepo.update.mock.calls[0].arguments[0], '1');
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).name, 'Updated Layout');
});