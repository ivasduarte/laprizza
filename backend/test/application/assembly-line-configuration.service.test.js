import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import * as service from '../../src/application/assembly-line-configuration/assembly-line-configuration.service.js';

// Objeto de mock básico do repositório
const mockRepo = {
  list: async () => [],
  findById: async () => null,
  create: async () => null,
  update: async () => null,
  remove: async () => null,
  countKitchenConfigurationReferences: async () => 0,
};

const validContent = {
  dimensions: { width: 12, length: 30, height: 4 },
  elements: [],
};

test('createConfiguration throws 400 for invalid content', async () => {
  await assert.rejects(
    async () => await service.createConfiguration({ name: 'Test', content: {} }, mockRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('createConfiguration saves valid configuration and returns DTO without an active state', async (t) => {
  const createdEntity = { _id: '123', name: 'Test', content: validContent };
  const create = t.mock.method(mockRepo, 'create', async () => createdEntity);

  const dto = await service.createConfiguration({ name: 'Test', content: validContent }, mockRepo);

  assert.deepEqual(create.mock.calls[0].arguments[0], { name: 'Test', content: validContent });
  assert.deepEqual(dto, { id: '123', name: 'Test', content: validContent });
});

test('getConfigurationById throws 404 if configuration does not exist', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => null);

  await assert.rejects(
    async () => await service.getConfigurationById('999', mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('removeConfiguration throws 409 if a kitchen configuration references the line', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', name: 'Line' }));
  const count = t.mock.method(mockRepo, 'countKitchenConfigurationReferences', async () => 2);
  const remove = t.mock.method(mockRepo, 'remove', async () => null);

  await assert.rejects(
    async () => await service.removeConfiguration('123', mockRepo),
    (err) => err instanceof AppError && err.status === 409 && err.message.includes('2 kitchen'),
  );
  assert.equal(count.mock.calls[0].arguments[0], '123');
  assert.equal(remove.mock.callCount(), 0);
});

test('removeConfiguration removes a line that no kitchen configuration references', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', name: 'Line' }));
  t.mock.method(mockRepo, 'countKitchenConfigurationReferences', async () => 0);
  const remove = t.mock.method(mockRepo, 'remove', async () => ({ _id: '123' }));

  await service.removeConfiguration('123', mockRepo);

  assert.equal(remove.mock.calls[0].arguments[0], '123');
});

test('removeConfiguration throws 404 if configuration does not exist', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => null);

  await assert.rejects(
    async () => await service.removeConfiguration('999', mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('updateConfiguration validates new content before saving', async (t) => {
  const entity = { _id: '123', content: validContent };
  t.mock.method(mockRepo, 'findById', async () => entity);
  const update = t.mock.method(mockRepo, 'update', async () => null);

  await assert.rejects(
    async () => await service.updateConfiguration('123', { content: { bad: 'data' } }, mockRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal(update.mock.callCount(), 0);
});

test('updateConfiguration rejects a blank name with 400', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', content: validContent }));

  await assert.rejects(
    async () => await service.updateConfiguration('123', { name: '   ' }, mockRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('updateConfiguration throws 404 if the line is deleted before saving', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', content: validContent }));
  t.mock.method(mockRepo, 'update', async () => null);

  await assert.rejects(
    async () => await service.updateConfiguration('123', { name: 'Line B' }, mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('updateConfiguration trims the name and only saves the changed fields', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', content: validContent }));
  const update = t.mock.method(mockRepo, 'update', async (id, data) => ({ _id: id, ...data }));

  const dto = await service.updateConfiguration('123', { name: '  Line B  ' }, mockRepo);

  assert.deepEqual(update.mock.calls[0].arguments[1], { name: 'Line B' });
  assert.equal(dto.name, 'Line B');
});

test('validateConfigurationContent validates dry-run data', async () => {
  const result = service.validateConfigurationContent(validContent);
  assert.equal(result.valid, true);

  assert.throws(
    () => service.validateConfigurationContent({ bad: 'data' }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test('createConfiguration forwards the property paths as AppError details (400)', async () => {
  const badContent = { dimensions: { width: 12, length: 30, height: 4 }, elements: [] };
  badContent.elements.push({
    id: 'a',
    type: 'assembly-line',
    modelReference: 'relative/path.gltf',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  });

  await assert.rejects(
    async () => await service.createConfiguration({ name: 'Bad', content: badContent }, mockRepo),
    (err) =>
      err instanceof AppError &&
      err.status === 400 &&
      Array.isArray(err.details) &&
      err.details[0].startsWith('/elements/0/modelReference'),
  );
});

test('validateConfigurationContent forwards the property paths as AppError details (400)', () => {
  assert.throws(
    () => service.validateConfigurationContent({ bad: 'data' }),
    (err) => err instanceof AppError && err.status === 400 && err.details.length > 0,
  );
});
