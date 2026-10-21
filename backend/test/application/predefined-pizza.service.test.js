import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/AppError.js';
import {
  createDummyPredefinedPizzaRepository,
  SEED_IDS as I,
} from '../infrastructure/predefined-pizzas.dummy.repository.js';
import {
  createPredefinedPizza,
  getPredefinedPizzaById,
  getPredefinedPizzaByName,
  listPredefinedPizzas,
  updatePredefinedPizza,
} from '../../src/application/predefined-pizza.service.js';

const validPizza = (overrides = {}) => ({
  productId: I.pizzaProduct,
  sizeIds: [I.sizeSmall, I.sizeLarge],
  componentIds: [I.cheese, I.dough, I.sauce], // desordenados de propósito
  ...overrides,
});

const rejects400 = (fragment) => (err) =>
  err instanceof AppError && err.status === 400 && err.message.includes(fragment);

test('createPredefinedPizza validates domain before storing and mapping DTO', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ sizeIds: [] }), dummyRepo),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal((await dummyRepo.list()).length, 0);

  const pizza = await createPredefinedPizza(validPizza(), dummyRepo);
  assert.ok(pizza.id);
  assert.equal(pizza.productId, I.pizzaProduct);
  assert.deepEqual(pizza.sizeIds, [I.sizeSmall, I.sizeLarge]);
  assert.deepEqual(pizza.defaultConfiguration.componentIds, [I.cheese, I.dough, I.sauce]);
  assert.equal(pizza.isActive, true);
  assert.equal(pizza._id, undefined);
});

test('createPredefinedPizza requires an appropriate sellable product', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ productId: I.unknown }), dummyRepo),
    rejects400('Product not found'),
  );
  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ productId: I.dough }), dummyRepo),
    rejects400('sellable'),
  );

  dummyRepo._getProducts().find((p) => p.id === I.pizzaProduct).isActive = false;
  await assert.rejects(
    async () => await createPredefinedPizza(validPizza(), dummyRepo),
    rejects400('active'),
  );
});

test('createPredefinedPizza rejects duplicate products', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();
  await createPredefinedPizza(validPizza(), dummyRepo);

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza(), dummyRepo),
    (err) => err.status === 409 && err.message.includes('already exists'),
  );
});

test('createPredefinedPizza enforces the default configuration rules', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();

  const cases = [
    ['repeated component', { componentIds: [I.dough, I.sauce, I.cheese, I.cheese] }, 'more than once'],
    ['inactive component', { componentIds: [I.dough, I.sauce, I.inactiveTopping] }, 'active'],
    ['unknown component', { componentIds: [I.dough, I.sauce, I.unknown] }, 'not found'],
    ['product that is not a component', { componentIds: [I.dough, I.sauce, I.pizzaProduct2] }, 'not designated'],
    ['below minQuantity (no dough)', { componentIds: [I.sauce, I.cheese] }, 'at least 1'],
    ['above maxQuantity (2 doughs)', { componentIds: [I.dough, I.doughExtra, I.sauce, I.cheese] }, 'at most 1'],
    ['above maxQuantity (2 cheeses)', { componentIds: [I.dough, I.sauce, I.cheese, I.cheeseExtra] }, 'at most 1'],
    ['size without Component Size Configuration', { componentIds: [I.dough, I.sauce, I.toppingNoLarge] }, 'Component Size Configuration'],
    ['inactive size', { sizeIds: [I.sizeSmall, I.sizeInactive] }, 'active'],
    ['unknown size', { sizeIds: [I.unknown] }, 'not found'],
  ];

  for (const [label, overrides, fragment] of cases) {
    await assert.rejects(
      async () => await createPredefinedPizza(validPizza(overrides), dummyRepo),
      rejects400(fragment),
      label,
    );
  }
  assert.equal((await dummyRepo.list()).length, 0);
});

test('createPredefinedPizza accepts a minimal configuration and several components of an unbounded type', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();

  const minimal = await createPredefinedPizza(
    validPizza({ productId: I.pizzaProduct2, componentIds: [I.dough] }),
    dummyRepo,
  );
  assert.deepEqual(minimal.defaultConfiguration.componentIds, [I.dough]);

  const pizza = await createPredefinedPizza(
    validPizza({
      sizeIds: [I.sizeSmall],
      componentIds: [I.dough, I.sauce, I.cheese, I.topping, I.toppingExtra, I.toppingNoLarge],
    }),
    dummyRepo,
  );
  assert.equal(pizza.defaultConfiguration.componentIds.length, 6);
});

test('getPredefinedPizzaById and getPredefinedPizzaByName return the default configuration ordered by assembly order', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();
  const created = await createPredefinedPizza(
    validPizza({ componentIds: [I.topping, I.cheese, I.dough, I.sauce] }),
    dummyRepo,
  );

  const byId = await getPredefinedPizzaById(created.id, dummyRepo);
  assert.equal(byId.product.name, 'Margherita');
  assert.deepEqual(byId.sizes.map((s) => s.name), ['Small', 'Large']);
  assert.deepEqual(
    byId.defaultConfiguration.components.map((c) => `${c.componentType.assemblyOrder}:${c.name}`),
    ['1:Classic Dough', '2:Tomato Sauce', '3:Mozzarella', '4:Mushrooms'],
  );
  assert.equal(byId.defaultConfiguration.components[0].componentType.maxQuantity, 1);
  assert.equal(byId.defaultConfiguration.components[3].componentType.maxQuantity, null);

  const byName = await getPredefinedPizzaByName('margherita', dummyRepo);
  assert.equal(byName.id, created.id);
});

test('getPredefinedPizzaById, getPredefinedPizzaByName and listPredefinedPizzas filter inactives', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();
  const created = await createPredefinedPizza(validPizza(), dummyRepo);

  await assert.rejects(
    async () => await getPredefinedPizzaById(I.unknown, dummyRepo),
    (err) => err.status === 404,
  );

  await dummyRepo.update(created.id, { isActive: false });

  await assert.rejects(
    async () => await getPredefinedPizzaById(created.id, dummyRepo),
    (err) => err.status === 404,
  );
  await assert.rejects(
    async () => await getPredefinedPizzaByName('Margherita', dummyRepo),
    (err) => err.status === 404,
  );

  const list = await listPredefinedPizzas({}, dummyRepo);
  assert.equal(list.length, 0); // O inativo não deve ser retornado
});

test('listPredefinedPizzas filters by product name', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();
  await createPredefinedPizza(validPizza(), dummyRepo);
  await createPredefinedPizza(validPizza({ productId: I.pizzaProduct2 }), dummyRepo);

  assert.equal((await listPredefinedPizzas({}, dummyRepo)).length, 2);
  assert.equal((await listPredefinedPizzas({ name: 'MARGH' }, dummyRepo)).length, 1);
  assert.equal((await listPredefinedPizzas({ name: 'xyz' }, dummyRepo)).length, 0);
});

test('updatePredefinedPizza revalidates the configuration and only supports deactivation', async () => {
  const dummyRepo = createDummyPredefinedPizzaRepository();
  const created = await createPredefinedPizza(validPizza(), dummyRepo);

  await assert.rejects(
    async () => await updatePredefinedPizza(created.id, { isActive: true }, dummyRepo),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );
  await assert.rejects(
    async () => await updatePredefinedPizza(created.id, {}, dummyRepo),
    (err) => err.status === 400 && err.message.includes('Nothing to update'),
  );
  await assert.rejects(
    async () => await updatePredefinedPizza(created.id, { componentIds: [I.sauce, I.cheese] }, dummyRepo),
    rejects400('at least 1'),
  );
  await assert.rejects(
    async () => await updatePredefinedPizza(I.unknown, { isActive: false }, dummyRepo),
    (err) => err.status === 404,
  );

  const changed = await updatePredefinedPizza(created.id, { componentIds: [I.dough, I.sauce, I.cheeseExtra] }, dummyRepo);
  assert.deepEqual(changed.defaultConfiguration.componentIds, [I.dough, I.sauce, I.cheeseExtra]);
  assert.deepEqual(changed.sizeIds, [I.sizeSmall, I.sizeLarge]);

  const resized = await updatePredefinedPizza(created.id, { sizeIds: [I.sizeSmall] }, dummyRepo);
  assert.deepEqual(resized.sizeIds, [I.sizeSmall]);

  const deactivated = await updatePredefinedPizza(created.id, { isActive: false }, dummyRepo);
  assert.equal(deactivated.isActive, false);
});
