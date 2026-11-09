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

test('activateConfiguration maps an unexpected atomic failure to a generic 500 without leaking internals', async (t) => {
  const entity = { _id: '123', isActive: false };
  t.mock.method(mockRepo, 'findById', async () => entity);
  t.mock.method(mockRepo, 'activateAtomic', async () => {
    throw new Error('Transaction failed: secret-host:27017');
  });

  await assert.rejects(
    async () => await service.activateConfiguration('123', mockRepo),
    (err) =>
      err instanceof AppError &&
      err.status === 500 &&
      err.message === 'Activation failed.' &&
      !err.message.includes('secret-host'),
  );
});

test('activateConfiguration maps duplicate key (11000) and write conflict (112) to 409', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', isActive: false }));

  for (const code of [11000, 112]) {
    t.mock.method(mockRepo, 'activateAtomic', async () => {
      const error = new Error('conflict');
      error.code = code;
      throw error;
    });

    await assert.rejects(
      async () => await service.activateConfiguration('123', mockRepo),
      (err) =>
        err instanceof AppError &&
        err.status === 409 &&
        err.message === 'Another activation is in progress.',
    );
  }
});

test('activateConfiguration maps a TransientTransactionError label to 409', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', isActive: false }));
  t.mock.method(mockRepo, 'activateAtomic', async () => {
    const error = new Error('transient');
    error.hasErrorLabel = (label) => label === 'TransientTransactionError';
    throw error;
  });

  await assert.rejects(
    async () => await service.activateConfiguration('123', mockRepo),
    (err) => err instanceof AppError && err.status === 409,
  );
});

test('activateConfiguration maps a target deleted during the transaction to 404', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', isActive: false }));
  t.mock.method(mockRepo, 'activateAtomic', async () => {
    const error = new Error('Configuration not found during activation');
    error.code = 'ACTIVATION_TARGET_NOT_FOUND';
    throw error;
  });

  await assert.rejects(
    async () => await service.activateConfiguration('123', mockRepo),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('activateConfiguration returns 500 when the repository returns nothing', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', isActive: false }));
  t.mock.method(mockRepo, 'activateAtomic', async () => null);

  await assert.rejects(
    async () => await service.activateConfiguration('123', mockRepo),
    (err) => err instanceof AppError && err.status === 500,
  );
});

test('activateConfiguration is idempotent for an already active configuration', async (t) => {
  t.mock.method(mockRepo, 'findById', async () => ({ _id: '123', isActive: true }));
  const activate = t.mock.method(mockRepo, 'activateAtomic', async () => null);

  const dto = await service.activateConfiguration('123', mockRepo);

  assert.equal(dto.isActive, true);
  assert.equal(activate.mock.callCount(), 0);
});

test('createConfiguration forwards the property paths as AppError details (400)', async () => {
  const badContent = { dimensions: { width: 10, length: 10, height: 3 }, elements: [] };
  badContent.elements.push({
    id: 'a',
    type: 'equipment',
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

test('activateConfiguration successfully returns activated configuration', async (t) => {
  const entity = { _id: '123', isActive: false };
  const activatedEntity = { _id: '123', isActive: true };

  t.mock.method(mockRepo, 'findById', async () => entity);
  t.mock.method(mockRepo, 'activateAtomic', async () => activatedEntity);

  const dto = await service.activateConfiguration('123', mockRepo);
  assert.equal(dto.isActive, true);
});