import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import { createDummyAllergenRepository } from '../infrastructure/allergens.dummy.repository.js';
import {
  createAllergen,
  getAllergenById,
  getAllergenByName,
  listAllergens,
  updateAllergen,
} from '../../src/application/allergen/allergen.service.js';

test('createAllergen validates domain before storing and mapping DTO', async () => {
  const dummyRepo = createDummyAllergenRepository();
  await assert.rejects(
    async () => await createAllergen({ name: '' }, dummyRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal((await dummyRepo.list()).length, 0);

  const allergen = await createAllergen({ name: 'Soja' }, dummyRepo);
  assert.ok(allergen.id);
  assert.equal(allergen.name, 'Soja');
  assert.equal(allergen.isActive, true);
  assert.equal(allergen._id, undefined);
});

test('createAllergen rejects duplicate names', async () => {
  const dummyRepo = createDummyAllergenRepository();
  await createAllergen({ name: 'Lactose' }, dummyRepo);

  await assert.rejects(
    async () => await createAllergen({ name: 'lactose' }, dummyRepo),
    (err) => err.status === 409 && err.message.includes('already in use'),
  );
});

test('getAllergenById, getAllergenByName and listAllergens filter inactives and map DTO', async () => {
  const dummyRepo = createDummyAllergenRepository();
  const created = await createAllergen({ name: 'Mostarda' }, dummyRepo);
  await dummyRepo.update(created.id, { isActive: false });

  await assert.rejects(
    async () => await getAllergenById(created.id, dummyRepo),
    (err) => err.status === 404,
  );
  await assert.rejects(
    async () => await getAllergenByName('Mostarda', dummyRepo),
    (err) => err.status === 404,
  );

  const list = await listAllergens({}, dummyRepo);
  assert.equal(list.length, 0);
});

test('updateAllergen allows only deactivation and checks references', async () => {
  const dummyRepo = createDummyAllergenRepository();
  const allergen = await createAllergen({ name: 'Camarão' }, dummyRepo);

  await assert.rejects(
    async () => await updateAllergen(allergen.id, { name: 'Outro' }, dummyRepo),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );

  dummyRepo._setReferenced(allergen.id);
  await assert.rejects(
    async () => await updateAllergen(allergen.id, { isActive: false }, dummyRepo),
    (err) => err.status === 409 && err.message.includes('referenced'),
  );

  dummyRepo._removeReference(allergen.id);
  const deactivated = await updateAllergen(allergen.id, { isActive: false }, dummyRepo);
  assert.equal(deactivated.isActive, false);
});
