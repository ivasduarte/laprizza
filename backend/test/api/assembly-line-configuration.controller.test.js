import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as controller from '../../src/api/assembly-line-configuration/assembly-line-configuration.controller.js';

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

const validContent = { dimensions: { width: 12, length: 30, height: 4 }, elements: [] };

test('AssemblyLineConfig Controller: catches errors and calls next', async () => {
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

test('AssemblyLineConfig Controller: remove returns 204 with no body', async () => {
  const req = { params: { id: '1' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '1', name: 'Line A' })),
    countKitchenConfigurationReferences: mock.fn(async () => 0),
    remove: mock.fn(async () => ({ _id: '1' })),
  };

  await controller.remove(req, res, next, mockRepo);

  assert.equal(mockRepo.remove.mock.calls[0].arguments[0], '1');
  assert.equal(statusOf(res), 204);
  assert.equal(res.send.mock.callCount(), 1);
  assert.equal(res.json.mock.callCount(), 0);
});

test('AssemblyLineConfig Controller: remove forwards a 409 to next when a kitchen references the line', async () => {
  const req = { params: { id: '1' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '1', name: 'Line A' })),
    countKitchenConfigurationReferences: mock.fn(async () => 1),
    remove: mock.fn(async () => null),
  };

  await controller.remove(req, res, next, mockRepo);

  assert.equal(next.mock.calls[0].arguments[0].status, 409);
  assert.equal(mockRepo.remove.mock.callCount(), 0);
  assert.equal(res.status.mock.callCount(), 0);
});

test('AssemblyLineConfig Controller: list returns 200 and array of configs', async () => {
  const req = {};
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    list: mock.fn(async () => [{ _id: '1', name: 'Line A', content: {} }]),
  };

  await controller.list(req, res, next, mockRepo);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).length, 1);
  assert.equal(bodyOf(res)[0].id, '1');
});

test('AssemblyLineConfig Controller: create returns 201 and new config', async () => {
  const req = { body: { name: 'New Line', content: validContent } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = { create: mock.fn(async (data) => ({ _id: '2', ...data })) };

  await controller.create(req, res, next, mockRepo);

  assert.equal(mockRepo.create.mock.calls[0].arguments[0].name, 'New Line');
  assert.equal('isActive' in mockRepo.create.mock.calls[0].arguments[0], false);
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).name, 'New Line');
  assert.equal(bodyOf(res).id, '2');
});

test('AssemblyLineConfig Controller: validate returns 200 and valid result for correct JSON', async () => {
  const req = { body: { content: validContent } };
  const res = createResponseMock();
  const next = mock.fn();

  await controller.validate(req, res, next);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).valid, true);
});

test('AssemblyLineConfig Controller: validate forwards a 400 to next for invalid JSON', async () => {
  const req = { body: { content: { elements: [] } } };
  const res = createResponseMock();
  const next = mock.fn();

  await controller.validate(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(next.mock.calls[0].arguments[0].status, 400);
  assert.equal(res.status.mock.callCount(), 0);
});

test('AssemblyLineConfig Controller: getById returns 200 and the requested config', async () => {
  const req = { params: { id: '1' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '1', name: 'Line A' })),
  };

  await controller.getById(req, res, next, mockRepo);

  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).id, '1');
});

test('AssemblyLineConfig Controller: update returns 200 and the updated config', async () => {
  const req = { params: { id: '1' }, body: { name: 'Updated Line' } };
  const res = createResponseMock();
  const next = mock.fn();
  const mockRepo = {
    findById: mock.fn(async () => ({ _id: '1', name: 'Old Line', content: validContent })),
    update: mock.fn(async (id, data) => ({ _id: id, ...data })),
  };

  await controller.update(req, res, next, mockRepo);

  assert.equal(mockRepo.update.mock.calls[0].arguments[0], '1');
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).name, 'Updated Line');
});
