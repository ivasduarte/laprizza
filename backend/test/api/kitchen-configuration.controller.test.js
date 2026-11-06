import test from 'node:test';
import assert from 'node:assert/strict';
import * as controller from '../../src/api/kitchen-configuration/kitchen-configuration.controller.js';

function createDummyResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send() {
      this.body = '';
      return this;
    },
  };
}

test('KitchenConfig Controller: getActive returns 200 and the active config', async () => {
  const req = {};
  const res = createDummyResponse();
  const next = () => {};

  // Fazemos mock ao repositório, que o controller injeta no serviço
  const mockRepo = {
    getActive: async () => ({ _id: '1', name: 'Active', content: {}, isActive: true }),
  };

  await controller.getActive(req, res, next, mockRepo);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isActive, true);
  assert.equal(res.body.id, '1');
});

test('KitchenConfig Controller: activate returns 200', async () => {
  const req = { params: { id: '123' } };
  const res = createDummyResponse();
  const next = () => {};

  const mockRepo = {
    findById: async () => ({ _id: '123', isActive: false }),
    activateAtomic: async () => ({ _id: '123', isActive: true }),
  };

  await controller.activate(req, res, next, mockRepo);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isActive, true);
});

test('KitchenConfig Controller: catches errors and calls next', async () => {
  const req = { params: { id: '123' } };
  const res = createDummyResponse();
  let errorReceived;
  const next = (err) => {
    errorReceived = err;
  };

  const mockRepo = {
    // Forçar um erro no repositório para testar se o controller o apanha e passa ao "next"
    findById: async () => {
      throw new Error('Database error');
    },
  };

  await controller.remove(req, res, next, mockRepo);
  assert.ok(errorReceived);
  assert.equal(errorReceived.message, 'Database error');
});

test('KitchenConfig Controller: list returns 200 and array of configs', async () => {
  const req = {};
  const res = createDummyResponse();
  const next = () => {};
  const mockRepo = {
    list: async () => [{ _id: '1', name: 'Standard', content: {}, isActive: false }],
  };

  await controller.list(req, res, next, mockRepo);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].id, '1');
});

test('KitchenConfig Controller: create returns 201 and new config', async () => {
  const req = {
    body: {
      name: 'New Layout',
      content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] },
    },
  };
  const res = createDummyResponse();
  const next = () => {};
  const mockRepo = { create: async (data) => ({ _id: '2', ...data }) };

  await controller.create(req, res, next, mockRepo);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.name, 'New Layout');
  assert.equal(res.body.id, '2');
});

test('KitchenConfig Controller: validate returns 200 and valid result for correct JSON', async () => {
  const req = {
    body: { content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] } },
  };
  const res = createDummyResponse();
  const next = () => {};

  await controller.validate(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.valid, true);
});

test('KitchenConfig Controller: getById returns 200 and the requested config', async () => {
  const req = { params: { id: '1' } };
  const res = createDummyResponse();
  const next = () => {};
  const mockRepo = { findById: async () => ({ _id: '1', name: 'Layout', isActive: false }) };

  await controller.getById(req, res, next, mockRepo);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, '1');
});

test('KitchenConfig Controller: update returns 200 and the updated config', async () => {
  const req = { params: { id: '1' }, body: { name: 'Updated Layout' } };
  const res = createDummyResponse();
  const next = () => {};
  const mockRepo = {
    findById: async () => ({
      _id: '1',
      name: 'Old Layout',
      content: { dimensions: { width: 10, length: 10, height: 3 }, elements: [] },
    }),
    update: async (id, data) => ({ _id: id, ...data }),
  };

  await controller.update(req, res, next, mockRepo);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.name, 'Updated Layout');
});