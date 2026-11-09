import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import {
  createAllergen,
  getAllergenById,
  getAllergenByName,
  listAllergens,
  updateAllergen,
} from '../../src/application/allergen/allergen.service.js';

const ALLERGEN_ID = 'a11e12000000000000000001';

const duplicateKeyError = () => Object.assign(new Error('Duplicate key'), { code: 11000 });

test('createAllergen validates domain before storing and mapping DTO', async () => {
  const allergenRepository = {
    create: mock.fn(async (data) => ({ _id: ALLERGEN_ID, ...data })),
  };

  await assert.rejects(
    async () => await createAllergen({ name: '' }, allergenRepository),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal(allergenRepository.create.mock.callCount(), 0);

  const allergen = await createAllergen({ name: 'Soja' }, allergenRepository);
  assert.equal(allergenRepository.create.mock.callCount(), 1);
  assert.deepEqual(allergenRepository.create.mock.calls[0].arguments[0], {
    name: 'Soja',
    isActive: true,
  });
  assert.ok(allergen.id);
  assert.equal(allergen.name, 'Soja');
  assert.equal(allergen.isActive, true);
  assert.equal(allergen._id, undefined);
});

test('createAllergen rejects duplicate names', async () => {
  const allergenRepository = {
    create: mock.fn(async () => {
      throw duplicateKeyError();
    }),
  };

  await assert.rejects(
    async () => await createAllergen({ name: 'lactose' }, allergenRepository),
    (err) => err.status === 409 && err.message.includes('already in use'),
  );
  assert.equal(allergenRepository.create.mock.callCount(), 1);
});

test('getAllergenById, getAllergenByName and listAllergens filter inactives and map DTO', async () => {
  const inactive = { _id: ALLERGEN_ID, name: 'Mostarda', isActive: false };
  const allergenRepository = {
    findById: mock.fn(async () => inactive),
    findByName: mock.fn(async () => inactive),
    list: mock.fn(async () => [inactive]),
    search: mock.fn(async () => []),
  };

  await assert.rejects(
    async () => await getAllergenById(ALLERGEN_ID, allergenRepository),
    (err) => err.status === 404,
  );
  assert.equal(allergenRepository.findById.mock.calls[0].arguments[0], ALLERGEN_ID);

  await assert.rejects(
    async () => await getAllergenByName('Mostarda', allergenRepository),
    (err) => err.status === 404,
  );
  assert.equal(allergenRepository.findByName.mock.calls[0].arguments[0], 'Mostarda');

  const list = await listAllergens({}, allergenRepository);
  assert.equal(list.length, 0);
  assert.equal(allergenRepository.list.mock.callCount(), 1);
  assert.equal(allergenRepository.search.mock.callCount(), 0);
});

test('updateAllergen allows only deactivation and checks references', async () => {
  const active = { _id: ALLERGEN_ID, name: 'Camarão', isActive: true };
  const allergenRepository = {
    findById: mock.fn(async () => active),
    isReferenced: mock.fn(async () => true),
    update: mock.fn(async (_id, data) => ({ ...active, ...data })),
  };

  await assert.rejects(
    async () => await updateAllergen(ALLERGEN_ID, { name: 'Outro' }, allergenRepository),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );
  assert.equal(allergenRepository.findById.mock.callCount(), 0);

  await assert.rejects(
    async () => await updateAllergen(ALLERGEN_ID, { isActive: false }, allergenRepository),
    (err) => err.status === 409 && err.message.includes('referenced'),
  );
  assert.equal(allergenRepository.isReferenced.mock.calls[0].arguments[0], ALLERGEN_ID);
  assert.equal(allergenRepository.update.mock.callCount(), 0);

  allergenRepository.isReferenced.mock.mockImplementation(async () => false);
  const deactivated = await updateAllergen(ALLERGEN_ID, { isActive: false }, allergenRepository);
  assert.equal(deactivated.isActive, false);
  assert.deepEqual(allergenRepository.update.mock.calls[0].arguments, [
    ALLERGEN_ID,
    { isActive: false },
  ]);
});
