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
