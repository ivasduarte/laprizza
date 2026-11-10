import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import Allergen from '../../src/infrastructure/allergen/allergen.model.js';
import * as allergenRepository from '../../src/infrastructure/allergen/allergen.repository.js';
import Products from '../../src/infrastructure/products/products.model.js';
import { startMongo, STARTUP_TIMEOUT_MS } from '../support/mongo-container.js';

/**
 * Integration tests: the Allergen repository against a real MongoDB (Testcontainers).
 * They cover what mocks cannot: the case-insensitive unique index, sorting and queries.
 */
let mongo;

before(
  async () => {
    mongo = await startMongo();
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

after(async () => {
  await mongo?.stop();
});

beforeEach(async () => {
  await Allergen.deleteMany({});
  await Products.deleteMany({});
});

const isDuplicateKeyError = (err) => err.code === 11000;

test('list returns the active allergens sorted by name', async () => {
  await allergenRepository.create({ name: 'Peanuts' });
  await allergenRepository.create({ name: 'Gluten' });
  await allergenRepository.create({ name: 'Milk', isActive: false });

  const allergens = await allergenRepository.list();

  assert.deepEqual(
    allergens.map((a) => a.name),
    ['Gluten', 'Peanuts'],
  );
});

test('findByName ignores case', async () => {
  await allergenRepository.create({ name: 'Gluten' });

  const found = await allergenRepository.findByName('gLuTeN');

  assert.equal(found.name, 'Gluten');
});

test('the unique index rejects a name that only differs in case', async () => {
  await allergenRepository.create({ name: 'Gluten' });

  await assert.rejects(allergenRepository.create({ name: 'GLUTEN' }), isDuplicateKeyError);
});

test('update returns the updated allergen and runs the validators', async () => {
  const allergen = await allergenRepository.create({ name: 'Nuts' });

  const updated = await allergenRepository.update(allergen._id, { name: 'Tree nuts' });
  assert.equal(updated.name, 'Tree nuts');

  await assert.rejects(allergenRepository.update(allergen._id, { name: '' }), {
    name: 'ValidationError',
  });
});

test('isReferenced is true only for allergens used by an active product', async () => {
  const used = await allergenRepository.create({ name: 'Gluten' });
  const unused = await allergenRepository.create({ name: 'Milk' });
  await Products.collection.insertOne({
    name: 'Margherita',
    allergenIds: [used._id],
    isActive: true,
  });

  assert.equal(await allergenRepository.isReferenced(String(used._id)), true);
  assert.equal(await allergenRepository.isReferenced(String(unused._id)), false);
});
