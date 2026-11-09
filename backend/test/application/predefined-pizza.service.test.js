import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import {
  createPredefinedPizza,
  getPredefinedPizzaById,
  getPredefinedPizzaByName,
  listPredefinedPizzas,
  updatePredefinedPizza,
} from '../../src/application/predefined-pizza/predefined-pizza.service.js';

const hexId = (prefix, n) => prefix + n.toString(16).padStart(24 - prefix.length, '0');

const I = {
  pizzaProduct: hexId('b10a', 1),
  pizzaProduct2: hexId('b10a', 2),
  dough: hexId('b10a', 3),
  doughExtra: hexId('b10a', 4),
  sauce: hexId('b10a', 5),
  cheese: hexId('b10a', 6),
  cheeseExtra: hexId('b10a', 7),
  topping: hexId('b10a', 8),
  toppingExtra: hexId('b10a', 9),
  inactiveTopping: hexId('b10a', 10),
  toppingNoLarge: hexId('b10a', 11),
  sizeSmall: hexId('b105', 1),
  sizeLarge: hexId('b105', 2),
  sizeInactive: hexId('b105', 3),
  typeDough: hexId('b107', 1),
  typeSauce: hexId('b107', 2),
  typeCheese: hexId('b107', 3),
  typeTopping: hexId('b107', 4),
  unknown: hexId('b1ff', 1),
  pizza: hexId('b10b', 1),
};

const bothSizes = [I.sizeSmall, I.sizeLarge];

const product = (id, name, extra = {}) => ({
  id,
  name,
  isActive: true,
  sellable: false,
  componentTypeId: null,
  configuredSizeIds: [],
  ...extra,
});

const component = (id, name, componentTypeId, configuredSizeIds = bothSizes, extra = {}) =>
  product(id, name, { componentTypeId, configuredSizeIds, ...extra });

/** Catalogue data returned by the lookup methods of the mocked repository. */
const PRODUCTS = [
  product(I.pizzaProduct, 'Margherita', { sellable: true }),
  product(I.pizzaProduct2, 'Pepperoni', { sellable: true }),
  component(I.dough, 'Classic Dough', I.typeDough),
  component(I.doughExtra, 'Whole Wheat Dough', I.typeDough),
  component(I.sauce, 'Tomato Sauce', I.typeSauce),
  component(I.cheese, 'Mozzarella', I.typeCheese),
  component(I.cheeseExtra, 'Cheddar', I.typeCheese),
  component(I.topping, 'Mushrooms', I.typeTopping),
  component(I.toppingExtra, 'Olives', I.typeTopping),
  component(I.inactiveTopping, 'Old Topping', I.typeTopping, bothSizes, { isActive: false }),
  component(I.toppingNoLarge, 'Anchovies', I.typeTopping, [I.sizeSmall]),
];

const SIZES = [
  { id: I.sizeSmall, name: 'Small', isActive: true },
  { id: I.sizeLarge, name: 'Large', isActive: true },
  { id: I.sizeInactive, name: 'Family', isActive: false },
];

const COMPONENT_TYPES = [
  { id: I.typeDough, name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
  { id: I.typeSauce, name: 'Base Sauce', assemblyOrder: 2, minQuantity: 0, maxQuantity: 1 },
  { id: I.typeCheese, name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 },
  { id: I.typeTopping, name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null },
];

/**
 * Mocked predefined-pizza repository. The lookups resolve against the catalogue data above
 * (`products` can be overridden per test); the pizza persistence methods are programmed per test.
 */
function createPizzaRepository({ products = PRODUCTS, pizza = null } = {}) {
  return {
    findProductById: mock.fn(async (id) => products.find((p) => p.id === String(id)) ?? null),
    findProductsByIds: mock.fn(async (ids) => products.filter((p) => ids.map(String).includes(p.id))),
    findSizesByIds: mock.fn(async (ids) => SIZES.filter((s) => ids.map(String).includes(s.id))),
    listComponentTypes: mock.fn(async () => COMPONENT_TYPES),
    create: mock.fn(async (data) => ({ _id: I.pizza, isActive: true, ...data })),
    findById: mock.fn(async (id) => (pizza && String(id) === String(pizza._id) ? pizza : null)),
    findByName: mock.fn(async () => pizza),
    update: mock.fn(async (_id, data) => ({ ...pizza, ...data })),
    list: mock.fn(async () => (pizza ? [pizza] : [])),
    search: mock.fn(async () => []),
  };
}

/** Stored predefined pizza document. */
const storedPizza = ({
  productId = I.pizzaProduct,
  sizeIds = bothSizes,
  componentIds = [I.cheese, I.dough, I.sauce],
  isActive = true,
  _id = I.pizza,
} = {}) => ({ _id, productId, sizeIds, defaultConfiguration: { componentIds }, isActive });

const validPizza = (overrides = {}) => ({
  productId: I.pizzaProduct,
  sizeIds: [I.sizeSmall, I.sizeLarge],
  componentIds: [I.cheese, I.dough, I.sauce], // desordenados de propósito
  ...overrides,
});

const rejects400 = (fragment) => (err) =>
  err instanceof AppError && err.status === 400 && err.message.includes(fragment);

test('createPredefinedPizza validates domain before storing and mapping DTO', async () => {
  const pizzaRepository = createPizzaRepository();

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ sizeIds: [] }), pizzaRepository),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal(pizzaRepository.create.mock.callCount(), 0);

  const pizza = await createPredefinedPizza(validPizza(), pizzaRepository);
  assert.ok(pizza.id);
  assert.equal(pizza.productId, I.pizzaProduct);
  assert.deepEqual(pizza.sizeIds, [I.sizeSmall, I.sizeLarge]);
  assert.deepEqual(pizza.defaultConfiguration.componentIds, [I.cheese, I.dough, I.sauce]);
  assert.equal(pizza.isActive, true);
  assert.equal(pizza._id, undefined);
  assert.equal(pizzaRepository.create.mock.callCount(), 1);
});

test('createPredefinedPizza requires an appropriate sellable product', async () => {
  const pizzaRepository = createPizzaRepository();

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ productId: I.unknown }), pizzaRepository),
    rejects400('Product not found'),
  );
  await assert.rejects(
    async () => await createPredefinedPizza(validPizza({ productId: I.dough }), pizzaRepository),
    rejects400('sellable'),
  );

  pizzaRepository.findProductById.mock.mockImplementation(async () =>
    product(I.pizzaProduct, 'Margherita', { sellable: true, isActive: false }),
  );
  await assert.rejects(
    async () => await createPredefinedPizza(validPizza(), pizzaRepository),
    rejects400('active'),
  );
  assert.equal(pizzaRepository.create.mock.callCount(), 0);
});

test('createPredefinedPizza rejects duplicate products', async () => {
  const pizzaRepository = createPizzaRepository();
  pizzaRepository.create.mock.mockImplementation(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { productId: 1 } });
  });

  await assert.rejects(
    async () => await createPredefinedPizza(validPizza(), pizzaRepository),
    (err) => err.status === 409 && err.message.includes('already exists'),
  );
});

test('createPredefinedPizza enforces the default configuration rules', async () => {
  const pizzaRepository = createPizzaRepository();

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
      async () => await createPredefinedPizza(validPizza(overrides), pizzaRepository),
      rejects400(fragment),
      label,
    );
  }
  assert.equal(pizzaRepository.create.mock.callCount(), 0);
});

test('createPredefinedPizza accepts a minimal configuration and several components of an unbounded type', async () => {
  const pizzaRepository = createPizzaRepository();

  const minimal = await createPredefinedPizza(
    validPizza({ productId: I.pizzaProduct2, componentIds: [I.dough] }),
    pizzaRepository,
  );
  assert.deepEqual(minimal.defaultConfiguration.componentIds, [I.dough]);

  const pizza = await createPredefinedPizza(
    validPizza({
      sizeIds: [I.sizeSmall],
      componentIds: [I.dough, I.sauce, I.cheese, I.topping, I.toppingExtra, I.toppingNoLarge],
    }),
    pizzaRepository,
  );
  assert.equal(pizza.defaultConfiguration.componentIds.length, 6);
  assert.equal(pizzaRepository.create.mock.callCount(), 2);
});

test('getPredefinedPizzaById and getPredefinedPizzaByName return the default configuration ordered by assembly order', async () => {
  const pizzaRepository = createPizzaRepository({
    pizza: storedPizza({ componentIds: [I.topping, I.cheese, I.dough, I.sauce] }),
  });

  const byId = await getPredefinedPizzaById(I.pizza, pizzaRepository);
  assert.equal(byId.product.name, 'Margherita');
  assert.deepEqual(
    byId.sizes.map((s) => s.name),
    ['Small', 'Large'],
  );
  assert.deepEqual(
    byId.defaultConfiguration.components.map((c) => `${c.componentType.assemblyOrder}:${c.name}`),
    ['1:Classic Dough', '2:Tomato Sauce', '3:Mozzarella', '4:Mushrooms'],
  );
  assert.equal(byId.defaultConfiguration.components[0].componentType.maxQuantity, 1);
  assert.equal(byId.defaultConfiguration.components[3].componentType.maxQuantity, null);

  const byName = await getPredefinedPizzaByName('margherita', pizzaRepository);
  assert.equal(byName.id, I.pizza);
  assert.equal(pizzaRepository.findByName.mock.calls[0].arguments[0], 'margherita');
});

test('getPredefinedPizzaById, getPredefinedPizzaByName and listPredefinedPizzas filter inactives', async () => {
  const pizzaRepository = createPizzaRepository({ pizza: storedPizza({ isActive: false }) });

  await assert.rejects(
    async () => await getPredefinedPizzaById(I.unknown, pizzaRepository),
    (err) => err.status === 404,
  );

  await assert.rejects(
    async () => await getPredefinedPizzaById(I.pizza, pizzaRepository),
    (err) => err.status === 404,
  );
  await assert.rejects(
    async () => await getPredefinedPizzaByName('Margherita', pizzaRepository),
    (err) => err.status === 404,
  );

  const list = await listPredefinedPizzas({}, pizzaRepository);
  assert.equal(list.length, 0); // O inativo não deve ser retornado
  assert.equal(pizzaRepository.list.mock.callCount(), 1);
});

test('listPredefinedPizzas filters by product name', async () => {
  const margherita = storedPizza();
  const pepperoni = storedPizza({ _id: hexId('b10b', 2), productId: I.pizzaProduct2 });
  const pizzaRepository = createPizzaRepository();
  pizzaRepository.list.mock.mockImplementation(async () => [margherita, pepperoni]);
  pizzaRepository.search.mock.mockImplementation(async (name) =>
    name.toLowerCase() === 'margh' ? [margherita] : [],
  );

  assert.equal((await listPredefinedPizzas({}, pizzaRepository)).length, 2);
  assert.equal((await listPredefinedPizzas({ name: 'MARGH' }, pizzaRepository)).length, 1);
  assert.equal((await listPredefinedPizzas({ name: 'xyz' }, pizzaRepository)).length, 0);
  assert.deepEqual(
    pizzaRepository.search.mock.calls.map((c) => c.arguments[0]),
    ['MARGH', 'xyz'],
  );
});

test('updatePredefinedPizza revalidates the configuration and only supports deactivation', async () => {
  const pizzaRepository = createPizzaRepository({ pizza: storedPizza() });

  await assert.rejects(
    async () => await updatePredefinedPizza(I.pizza, { isActive: true }, pizzaRepository),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );
  await assert.rejects(
    async () => await updatePredefinedPizza(I.pizza, {}, pizzaRepository),
    (err) => err.status === 400 && err.message.includes('Nothing to update'),
  );
  await assert.rejects(
    async () =>
      await updatePredefinedPizza(I.pizza, { componentIds: [I.sauce, I.cheese] }, pizzaRepository),
    rejects400('at least 1'),
  );
  await assert.rejects(
    async () => await updatePredefinedPizza(I.unknown, { isActive: false }, pizzaRepository),
    (err) => err.status === 404,
  );
  assert.equal(pizzaRepository.update.mock.callCount(), 0);

  const changed = await updatePredefinedPizza(
    I.pizza,
    { componentIds: [I.dough, I.sauce, I.cheeseExtra] },
    pizzaRepository,
  );
  assert.deepEqual(changed.defaultConfiguration.componentIds, [I.dough, I.sauce, I.cheeseExtra]);
  assert.deepEqual(changed.sizeIds, [I.sizeSmall, I.sizeLarge]);

  const resized = await updatePredefinedPizza(I.pizza, { sizeIds: [I.sizeSmall] }, pizzaRepository);
  assert.deepEqual(resized.sizeIds, [I.sizeSmall]);
  // The current components are revalidated together with the new sizes.
  assert.deepEqual(pizzaRepository.update.mock.calls[1].arguments[1], {
    sizeIds: [I.sizeSmall],
    defaultConfiguration: { componentIds: [I.cheese, I.dough, I.sauce] },
  });

  const deactivated = await updatePredefinedPizza(I.pizza, { isActive: false }, pizzaRepository);
  assert.equal(deactivated.isActive, false);
  assert.deepEqual(pizzaRepository.update.mock.calls[2].arguments, [I.pizza, { isActive: false }]);
});
