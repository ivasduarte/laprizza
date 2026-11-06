import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import * as service from '../../src/application/kitchen-configuration/kitchen-configuration.service.js';

// Objeto de mock básico do repositório
const mockRepo = {
  list: async () => [],
  findById: async () => null,
  create: async () => null,
  update: async () => null,
  remove: async () => null,
  getActive: async () => null,
  activateAtomic: async () => null,
};

const validContent = {
  dimensions: { width: 10, length: 10, height: 3 },
  elements: [],
};

test('createConfiguration throws 400 for invalid content', async () => {
  await assert.rejects(
    async () => await service.createConfiguration({ name: 'Test', content: {} }, mockRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('createConfiguration saves valid configuration and returns DTO', async (t) => {
  const createdEntity = { _id: '123', name: 'Test', content: validContent, isActive: false };
  t.mock.method(mockRepo, 'create', async () => createdEntity);

  const dto = await service.createConfiguration({ name: 'Test', content: validContent }, mockRepo);

  assert.equal(dto.id, '123');
  assert.equal(dto.isActive, false);
});

test('removeConfiguration throws 409 if configuration is active', async (t) => {
  const activeEntity = { _id: '123', isActive: true };
  t.mock.method(mockRepo, 'findById', async () => activeEntity);

  await assert.rejects(
    async () => await service.removeConfiguration('123', mockRepo),
    (err) => err instanceof AppError && err.status === 409,
  );
});

test('updateConfiguration validates new content before saving', async (t) => {
  const entity = { _id: '123', isActive: true, content: validContent };
  t.mock.method(mockRepo, 'findById', async () => entity);

  await assert.rejects(
    async () => await service.updateConfiguration('123', { content: { bad: 'data' } }, mockRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('validateConfigurationContent validates dry-run data', async () => {
  const result = service.validateConfigurationContent(validContent);
  assert.equal(result.valid, true);

  assert.throws(
    () => service.validateConfigurationContent({ bad: 'data' }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('getActiveConfiguration throws 404 explicitly if no configuration is active (ADR-0025)', async (t) => {
  t.mock.method(mockRepo, 'getActive', async () => null);

  await assert.rejects(
    async () => await service.getActiveConfiguration(mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('activateConfiguration throws 404 if target does not exist', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => null);

  await assert.rejects(
    async () => await service.activateConfiguration('999', mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('activateConfiguration wraps atomic failure in a 500 error', async (t) => {
  const entity = { _id: '123', isActive: false };
  t.mock.method(mockRepo, 'findById', async () => entity);
  t.mock.method(mockRepo, 'activateAtomic', async () => {
    throw new Error('Transaction failed');
  });

  await assert.rejects(
    async () => await service.activateConfiguration('123', mockRepo),
    (err) =>
      err instanceof AppError && err.status === 500 && err.message.includes('Transaction failed'),
  );
});

test('activateConfiguration successfully returns activated configuration', async (t) => {
  const entity = { _id: '123', isActive: false };
  const activatedEntity = { _id: '123', isActive: true };

  t.mock.method(mockRepo, 'findById', async () => entity);
  t.mock.method(mockRepo, 'activateAtomic', async () => activatedEntity);

  const dto = await service.activateConfiguration('123', mockRepo);
  assert.equal(dto.isActive, true);
});