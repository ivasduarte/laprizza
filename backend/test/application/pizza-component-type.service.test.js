import test from 'node:test';
import assert from 'node:assert/strict';
import { createDummyPizzaComponentTypesRepository } from '../infrastructure/pizza-component-type.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import {
  listPizzaComponentTypes,
  createPizzaComponentType,
  getPizzaComponentTypeById,
  updatePizzaComponentType,
  removePizzaComponentType,
  toPizzaComponentTypeDTO,
} from '../../src/application/pizza-component-type/pizza-component-type.service.js';

// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const CHEESE = { name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 };
const TOPPING = { name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null };

test('toPizzaComponentTypeDTO exposes the identifier as id and hides database fields', () => {
  const dto = toPizzaComponentTypeDTO({ _id: 'abc', __v: 0, ...CHEESE, isActive: true });
 
  assert.deepEqual(dto, { id: 'abc', ...CHEESE, isActive: true });
  assert.equal(dto._id, undefined);
  assert.equal(dto.__v, undefined);
});

test('createPizzaComponentType saves a normalized name and returns an active DTO', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  const created = await createPizzaComponentType({ ...CHEESE, name: '  Extra   Cheese ' }, repo);
 
  assert.equal(repo._getTypes().length, 1);
  assert.ok(created.id);
  assert.equal(created.name, 'Extra Cheese');
  assert.equal(created.assemblyOrder, 3);
  assert.equal(created.minQuantity, 0);
  assert.equal(created.maxQuantity, 1);
  assert.equal(created.isActive, true);
  assert.equal(created._id, undefined);
});
 
test('createPizzaComponentType treats an omitted or null maximum as unbounded', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  const omitted = await createPizzaComponentType(
    { name: 'Topping', assemblyOrder: 4, minQuantity: 0 },
    repo,
  );
  const explicitNull = await createPizzaComponentType(
    { name: 'Extras', assemblyOrder: 5, minQuantity: 0, maxQuantity: null },
    repo,
  );
 
  assert.equal(omitted.maxQuantity, null);
  assert.equal(explicitNull.maxQuantity, null);
});
 
test('createPizzaComponentType accepts a minimum equal to the maximum', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  const created = await createPizzaComponentType(
    { name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
    repo,
  );
 
  assert.equal(created.minQuantity, 1);
  assert.equal(created.maxQuantity, 1);
});
 
test('createPizzaComponentType rejects invalid data without saving', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  const invalidData = [
    {},
    { ...CHEESE, name: '   ' },
    { ...CHEESE, name: undefined },
    { ...CHEESE, assemblyOrder: 0 },
    { ...CHEESE, assemblyOrder: undefined },
    { ...CHEESE, assemblyOrder: 1.5 },
    { ...CHEESE, minQuantity: -1 },
    { ...CHEESE, minQuantity: undefined },
    { ...CHEESE, maxQuantity: 0 },
    { ...CHEESE, maxQuantity: 1.5 },
    { ...CHEESE, minQuantity: 2, maxQuantity: 1 },
  ];
 
  for (const data of invalidData) {
    await assert.rejects(
      async () => await createPizzaComponentType(data, repo),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }
 
  assert.equal(repo._getTypes().length, 0);
});
 
test('createPizzaComponentType returns 409 Conflict on duplicate name', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType({ ...CHEESE, name: 'Café' }, repo);
 
  await assert.rejects(
    async () => await createPizzaComponentType({ ...CHEESE, name: 'CAFE', assemblyOrder: 9 }, repo),
    (err) => err.status === 409 && /name/i.test(err.message),
  );
 
  assert.equal(repo._getTypes().length, 1);
});
 
test('createPizzaComponentType returns 409 Conflict on duplicate assembly order', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType(CHEESE, repo);
 
  await assert.rejects(
    async () => await createPizzaComponentType({ ...TOPPING, assemblyOrder: 3 }, repo),
    (err) => err.status === 409 && /assembly order/i.test(err.message),
  );
 
  assert.equal(repo._getTypes().length, 1);
});
 
test('createPizzaComponentType rethrows errors that are not duplicates', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  repo.create = async () => {
    throw new Error('Database offline');
  };
 
  await assert.rejects(
    async () => await createPizzaComponentType(CHEESE, repo),
    (err) => err.message === 'Database offline' && err.status === undefined,
  );
});

test('listPizzaComponentTypes without a name returns the active types sorted by assembly order', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType(TOPPING, repo);
  await createPizzaComponentType(CHEESE, repo);
 
  const types = await listPizzaComponentTypes(undefined, repo);
 
  assert.ok(Array.isArray(types));
  assert.deepEqual(
    types.map((t) => t.name),
    ['Cheese', 'Topping'],
  );
  assert.ok(types[0].id);
  assert.equal(types[0]._id, undefined);
});
 
test('listPizzaComponentTypes without a name does not return removed types', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  await createPizzaComponentType(TOPPING, repo);
  await removePizzaComponentType(cheese.id, repo, productsRepo);
 
  const types = await listPizzaComponentTypes(undefined, repo);
 
  assert.deepEqual(
    types.map((t) => t.name),
    ['Topping'],
  );
});
 
test('listPizzaComponentTypes finds the exact name ignoring case and accents', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType({ ...CHEESE, name: 'Café' }, repo);
  await createPizzaComponentType(TOPPING, repo);
 
  const found = await listPizzaComponentTypes('cafe', repo);
 
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Café');
});
 
test('listPizzaComponentTypes finds a removed type by name and flags it as inactive', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  await removePizzaComponentType(cheese.id, repo, productsRepo);
 
  const found = await listPizzaComponentTypes('cheese', repo);
 
  assert.equal(found.length, 1);
  assert.equal(found[0].isActive, false);
});
 
test('listPizzaComponentTypes returns an empty list for partial or blank names', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType(CHEESE, repo);
 
  assert.deepEqual(await listPizzaComponentTypes('chee', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('Ch', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('   ', repo), []);
});

test('getPizzaComponentTypeById returns the type or throws 404', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
 
  const found = await getPizzaComponentTypeById(created.id, repo);
  assert.deepEqual(found, created);
 
  await assert.rejects(
    async () => await getPizzaComponentTypeById(NON_EXISTENT_ID, repo),
    (err) => err.status === 404,
  );
});
 
test('getPizzaComponentTypeById also returns a removed type, flagged as inactive', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
  await removePizzaComponentType(created.id, repo, productsRepo);
 
  const found = await getPizzaComponentTypeById(created.id, repo);
 
  assert.equal(found.id, created.id);
  assert.equal(found.isActive, false);
});
 
test('updatePizzaComponentType changes all the properties', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
 
  const updated = await updatePizzaComponentType(
    created.id,
    { name: '  Extra   Cheese ', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
    repo,
  );
 
  assert.equal(updated.id, created.id);
  assert.equal(updated.name, 'Extra Cheese');
  assert.equal(updated.assemblyOrder, 7);
  assert.equal(updated.minQuantity, 1);
  assert.equal(updated.maxQuantity, null);
  assert.equal(updated.isActive, true);
  assert.equal(repo._getTypes()[0].name, 'Extra Cheese');
});
 
test('updatePizzaComponentType keeps its own assembly order and allows changing only the case of its name', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
 
  const updated = await updatePizzaComponentType(created.id, { ...CHEESE, name: 'cheese' }, repo);
 
  assert.equal(updated.name, 'cheese');
  assert.equal(updated.assemblyOrder, 3);
});
 
test('updatePizzaComponentType rejects invalid data without changing the type', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
 
  for (const data of [{}, { ...CHEESE, name: '  ' }, { ...CHEESE, minQuantity: 5, maxQuantity: 2 }]) {
    await assert.rejects(
      async () => await updatePizzaComponentType(created.id, data, repo),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }
 
  assert.deepEqual(repo._getTypes()[0].name, 'Cheese');
  assert.equal(repo._getTypes()[0].maxQuantity, 1);
});
 
test('updatePizzaComponentType returns 409 Conflict on duplicate name', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType(CHEESE, repo);
  const topping = await createPizzaComponentType(TOPPING, repo);
 
  await assert.rejects(
    async () => await updatePizzaComponentType(topping.id, { ...TOPPING, name: 'CHEESE' }, repo),
    (err) => err.status === 409 && /name/i.test(err.message),
  );
});
 
test('updatePizzaComponentType returns 409 Conflict on duplicate assembly order', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  await createPizzaComponentType(CHEESE, repo);
  const topping = await createPizzaComponentType(TOPPING, repo);
 
  await assert.rejects(
    async () => await updatePizzaComponentType(topping.id, { ...TOPPING, assemblyOrder: 3 }, repo),
    (err) => err.status === 409 && /assembly order/i.test(err.message),
  );
});
 
test('updatePizzaComponentType throws 404 if the type does not exist', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  await assert.rejects(
    async () => await updatePizzaComponentType(NON_EXISTENT_ID, CHEESE, repo),
    (err) => err.status === 404,
  );
});
 
test('updatePizzaComponentType validates the data before looking for the type', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
 
  await assert.rejects(
    async () => await updatePizzaComponentType(NON_EXISTENT_ID, { name: '' }, repo),
    (err) => err.status === 400,
  );
});
 
test('updatePizzaComponentType throws 404 for a removed type and leaves it unchanged', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
  await removePizzaComponentType(created.id, repo, productsRepo);
 
  await assert.rejects(
    async () => await updatePizzaComponentType(created.id, { ...CHEESE, name: 'Other' }, repo),
    (err) => err.status === 404,
  );
 
  assert.equal(repo._getTypes()[0].name, 'Cheese');
  assert.equal(repo._getTypes()[0].isActive, false);
});
 
test('removePizzaComponentType deactivates the type without deleting it', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
 
  const result = await removePizzaComponentType(created.id, repo, productsRepo);
 
  assert.equal(result, undefined);
  assert.equal(repo._getTypes().length, 1);
  assert.equal(repo._getTypes()[0].isActive, false);
  assert.deepEqual(await listPizzaComponentTypes(undefined, repo), []);
});
 
test('removePizzaComponentType throws 404 if the type does not exist', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
 
  await assert.rejects(
    async () => await removePizzaComponentType(NON_EXISTENT_ID, repo, productsRepo),
    (err) => err.status === 404,
  );
});
 
test('removePizzaComponentType throws 404 if the type was already removed', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
  await removePizzaComponentType(created.id, repo, productsRepo);
 
  await assert.rejects(
    async () => await removePizzaComponentType(created.id, repo, productsRepo),
    (err) => err.status === 404,
  );
});
 
test('removing a type frees its name and assembly order to be used again', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createPizzaComponentType(CHEESE, repo);
  await removePizzaComponentType(created.id, repo, productsRepo);
 
  const recreated = await createPizzaComponentType(CHEESE, repo);
 
  assert.notEqual(recreated.id, created.id);
  assert.equal(recreated.isActive, true);
  assert.equal(repo._getTypes().length, 2);
});

test('removePizzaComponentType throws 409 Conflict if a product references the type', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  await productsRepo.create({ name: 'Mozzarella', pizzaComponentTypeId: cheese.id });

  await assert.rejects(
    async () => await removePizzaComponentType(cheese.id, repo, productsRepo),
    (err) => err.status === 409 && /referenced/i.test(err.message),
  );

  // The type is still active and keeps being listed
  assert.equal(repo._getTypes()[0].isActive, true);
  assert.deepEqual(
    (await listPizzaComponentTypes(undefined, repo)).map((t) => t.name),
    ['Cheese'],
  );
});

test('removePizzaComponentType ignores inactive products', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  await productsRepo.create({
    name: 'Mozzarella',
    pizzaComponentTypeId: cheese.id,
    isActive: false,
  });

  await removePizzaComponentType(cheese.id, repo, productsRepo);

  assert.equal(repo._getTypes()[0].isActive, false);
});

test('removePizzaComponentType only checks the products of the type being removed', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  const topping = await createPizzaComponentType(TOPPING, repo);
  await productsRepo.create({ name: 'Mozzarella', pizzaComponentTypeId: cheese.id });
  await productsRepo.create({ name: 'Water', pizzaComponentTypeId: null });

  // The topping type has no products: it can be removed, the cheese type cannot
  assert.equal(await removePizzaComponentType(topping.id, repo, productsRepo), undefined);
  assert.equal(repo._getTypes().find((t) => t._id === topping.id).isActive, false);
  await assert.rejects(
    async () => await removePizzaComponentType(cheese.id, repo, productsRepo),
    (err) => err.status === 409,
  );
});

test('removePizzaComponentType removes the type once no product references it', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  const cheese = await createPizzaComponentType(CHEESE, repo);
  const product = await productsRepo.create({ name: 'Mozzarella', pizzaComponentTypeId: cheese.id });

  // The product stops being a pizza component
  await productsRepo.update(product._id, { pizzaComponentTypeId: null });

  assert.equal(await removePizzaComponentType(cheese.id, repo, productsRepo), undefined);
  assert.equal(repo._getTypes()[0].isActive, false);
});

test('removePizzaComponentType checks that the type exists before looking at the products', async () => {
  const repo = createDummyPizzaComponentTypesRepository();
  const productsRepo = createDummyProductsRepository();
  productsRepo.existsByPizzaComponentType = async () => {
    throw new Error('The products must not be checked');
  };

  await assert.rejects(
    async () => await removePizzaComponentType(NON_EXISTENT_ID, repo, productsRepo),
    (err) => err.status === 404,
  );
});