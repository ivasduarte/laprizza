import test from 'node:test';
import assert from 'node:assert/strict';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyPizzaSizeRepository } from '../infrastructure/pizza-size.dummy.repository.js';
import { createSize } from '../../src/application/pizza-size/pizza-size.service.js';
import {
  toComponentSizeConfigurationDTO,
  listComponentSizeConfigurations,
  createComponentSizeConfiguration,
  getComponentSizeConfiguration,
  updateComponentSizeConfiguration,
  removeComponentSizeConfiguration,
} from '../../src/application/component-size-configuration/component-size-configuration.service.js';

// Valid identifier format (24 hex characters) that does not belong to any product or pizza size
const NON_EXISTENT_ID = 'abcdef000000000000000999';

const PIZZA_COMPONENT_TYPE_ID = 'abcdef000000000000000001';

// Pizza components: a stock controlled one (Mozzarella) and one without stock control (Oregano)
const MOZZARELLA = {
  name: 'Mozzarella',
  description: 'Cheese',
  stockControlled: true,
  pizzaComponentTypeId: PIZZA_COMPONENT_TYPE_ID,
};
const OREGANO = {
  name: 'Oregano',
  description: 'Herb',
  stockControlled: false,
  pizzaComponentTypeId: PIZZA_COMPONENT_TYPE_ID,
};
// A product that is not a pizza component
const COLA = { name: 'Cola', description: 'Drink', stockControlled: false };

async function setup() {
  const productsRepository = createDummyProductsRepository();
  const sizeRepository = createDummyPizzaSizeRepository();
  const small = await createSize({ name: 'Small' }, sizeRepository);
  const large = await createSize({ name: 'Large' }, sizeRepository);

  return {
    productsRepository,
    sizeRepository,
    repos: { productsRepository, sizeRepository },
    small,
    large,
  };
}

const configurationsOf = async (productsRepository, productId) =>
  (await productsRepository.findById(productId)).sizeConfigurations;

// Repositories where the write operation reports that nothing was changed (null), which is what
// the real repository does when another request changed the configuration in the meantime.
const withNullOperation = (repos, operation) => ({
  ...repos,
  productsRepository: { ...repos.productsRepository, [operation]: async () => null },
});

test('toComponentSizeConfigurationDTO exposes the product and the pizza size as strings', () => {
  const dto = toComponentSizeConfigurationDTO('prod1', {
    pizzaSizeId: { toString: () => 'size1' },
    price: 2.5,
    stockUnitsConsumed: 3,
    _id: 'internal',
  });

  assert.deepEqual(dto, {
    productId: 'prod1',
    pizzaSizeId: 'size1',
    price: 2.5,
    stockUnitsConsumed: 3,
  });
});

test('toComponentSizeConfigurationDTO turns missing stock units into null', () => {
  const dto = toComponentSizeConfigurationDTO('prod1', { pizzaSizeId: 'size1', price: 1 });

  assert.equal(dto.stockUnitsConsumed, null);
});

test('createComponentSizeConfiguration saves the configuration of a stock controlled component', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  const created = await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 2.5, stockUnitsConsumed: 3 },
    repos,
  );

  assert.deepEqual(created, {
    productId: product._id,
    pizzaSizeId: small.id,
    price: 2.5,
    stockUnitsConsumed: 3,
  });
  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: small.id, price: 2.5, stockUnitsConsumed: 3 },
  ]);
});

test('createComponentSizeConfiguration saves a component without stock control without stock units', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(OREGANO);

  const omitted = await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 0.5 },
    repos,
  );
  assert.equal(omitted.stockUnitsConsumed, null);

  const explicitNull = await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: large.id, price: 1, stockUnitsConsumed: null },
    repos,
  );
  assert.equal(explicitNull.stockUnitsConsumed, null);
});

test('createComponentSizeConfiguration accepts a price of zero', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(OREGANO);

  const created = await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 0 },
    repos,
  );

  assert.equal(created.price, 0);
});

test('createComponentSizeConfiguration allows several sizes for the same component and the same size for several components', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const mozzarella = await productsRepository.create(MOZZARELLA);
  const oregano = await productsRepository.create(OREGANO);

  await createComponentSizeConfiguration(
    mozzarella._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await createComponentSizeConfiguration(
    mozzarella._id,
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    repos,
  );
  await createComponentSizeConfiguration(oregano._id, { pizzaSizeId: small.id, price: 0.5 }, repos);

  assert.equal((await configurationsOf(productsRepository, mozzarella._id)).length, 2);
  assert.equal((await configurationsOf(productsRepository, oregano._id)).length, 1);
});

test('createComponentSizeConfiguration rejects invalid data without saving', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  const invalidData = [
    undefined,
    {},
    { pizzaSizeId: small.id, stockUnitsConsumed: 1 },
    { pizzaSizeId: small.id, price: -1, stockUnitsConsumed: 1 },
    { pizzaSizeId: small.id, price: '2', stockUnitsConsumed: 1 },
    { pizzaSizeId: small.id, price: NaN, stockUnitsConsumed: 1 },
    { pizzaSizeId: small.id, price: null, stockUnitsConsumed: 1 },
    { price: 2, stockUnitsConsumed: 1 },
    { pizzaSizeId: '   ', price: 2, stockUnitsConsumed: 1 },
    { pizzaSizeId: 123, price: 2, stockUnitsConsumed: 1 },
  ];

  for (const data of invalidData) {
    await assert.rejects(
      async () => await createComponentSizeConfiguration(product._id, data, repos),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('createComponentSizeConfiguration requires stock units for stock controlled components', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  for (const stockUnitsConsumed of [undefined, null, 0, -1, 1.5, '2']) {
    await assert.rejects(
      async () =>
        await createComponentSizeConfiguration(
          product._id,
          { pizzaSizeId: small.id, price: 2, stockUnitsConsumed },
          repos,
        ),
      (err) => err.status === 400 && /stock units consumed/i.test(err.message),
      String(stockUnitsConsumed),
    );
  }

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('createComponentSizeConfiguration does not accept stock units for components without stock control', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(OREGANO);

  for (const stockUnitsConsumed of [0, 1, 5]) {
    await assert.rejects(
      async () =>
        await createComponentSizeConfiguration(
          product._id,
          { pizzaSizeId: small.id, price: 2, stockUnitsConsumed },
          repos,
        ),
      (err) => err.status === 400 && /stock controlled/i.test(err.message),
      String(stockUnitsConsumed),
    );
  }

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('createComponentSizeConfiguration rejects products that are not pizza components', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(COLA);

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(product._id, { pizzaSizeId: small.id, price: 2 }, repos),
    (err) => err.status === 400 && /pizza component/i.test(err.message),
  );

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('createComponentSizeConfiguration throws 404 if the product does not exist or is inactive', async () => {
  const { repos, productsRepository, small } = await setup();
  const data = { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 };

  await assert.rejects(
    async () => await createComponentSizeConfiguration(NON_EXISTENT_ID, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  const inactive = await productsRepository.create({ ...MOZZARELLA, isActive: false });
  await assert.rejects(
    async () => await createComponentSizeConfiguration(inactive._id, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  assert.equal((await configurationsOf(productsRepository, inactive._id)).length, 0);
});

test('createComponentSizeConfiguration throws 404 if the pizza size does not exist or is inactive', async () => {
  const { repos, productsRepository, sizeRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        product._id,
        { pizzaSizeId: NON_EXISTENT_ID, price: 1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 404 && /pizza size/i.test(err.message),
  );

  await sizeRepository.update(small.id, { isActive: false });
  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        product._id,
        { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 404 && /pizza size/i.test(err.message),
  );

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('createComponentSizeConfiguration returns 409 Conflict if the size is already configured', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        product._id,
        { pizzaSizeId: small.id, price: 9, stockUnitsConsumed: 9 },
        repos,
      ),
    (err) => err.status === 409 && /already exists/i.test(err.message),
  );

  // The existing configuration is kept as it was
  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
  ]);
});

test('createComponentSizeConfiguration returns 409 Conflict if another request configured the size in the meantime', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        product._id,
        { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
        withNullOperation(repos, 'addSizeConfiguration'),
      ),
    (err) => err.status === 409 && /already exists/i.test(err.message),
  );
});

test('createComponentSizeConfiguration validates the data before looking for the product', async () => {
  const { repos, small } = await setup();

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        NON_EXISTENT_ID,
        { pizzaSizeId: small.id, price: -1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
});

test('createComponentSizeConfiguration checks the product is a pizza component before looking for the pizza size', async () => {
  const { repos, productsRepository } = await setup();
  const product = await productsRepository.create(COLA);

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        product._id,
        { pizzaSizeId: NON_EXISTENT_ID, price: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
});

test('listComponentSizeConfigurations returns the configurations of the product', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    repos,
  );

  const list = await listComponentSizeConfigurations(product._id, repos);

  assert.deepEqual(list, [
    { productId: product._id, pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    { productId: product._id, pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ]);
});

test('listComponentSizeConfigurations returns an empty list for a product without configurations', async () => {
  const { repos, productsRepository } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  assert.deepEqual(await listComponentSizeConfigurations(product._id, repos), []);
});

test('listComponentSizeConfigurations also works for an inactive product', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await productsRepository.update(product._id, { isActive: false });

  assert.equal((await listComponentSizeConfigurations(product._id, repos)).length, 1);
});

test('listComponentSizeConfigurations throws 404 if the product does not exist', async () => {
  const { repos } = await setup();

  await assert.rejects(
    async () => await listComponentSizeConfigurations(NON_EXISTENT_ID, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );
});

test('getComponentSizeConfiguration returns the configuration of the pizza size', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    repos,
  );

  const found = await getComponentSizeConfiguration(product._id, large.id, repos);

  assert.deepEqual(found, {
    productId: product._id,
    pizzaSizeId: large.id,
    price: 2,
    stockUnitsConsumed: 2,
  });
});

test('getComponentSizeConfiguration also works for an inactive product', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await productsRepository.update(product._id, { isActive: false });

  const found = await getComponentSizeConfiguration(product._id, small.id, repos);

  assert.equal(found.price, 1);
});

test('getComponentSizeConfiguration throws 404 if the product or the configuration does not exist', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );

  await assert.rejects(
    async () => await getComponentSizeConfiguration(NON_EXISTENT_ID, small.id, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  // Existing size, but not configured for this component
  await assert.rejects(
    async () => await getComponentSizeConfiguration(product._id, large.id, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );

  await assert.rejects(
    async () => await getComponentSizeConfiguration(product._id, NON_EXISTENT_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('updateComponentSizeConfiguration changes the price and the stock units', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    repos,
  );

  const updated = await updateComponentSizeConfiguration(
    product._id,
    small.id,
    { price: 1.75, stockUnitsConsumed: 4 },
    repos,
  );

  assert.deepEqual(updated, {
    productId: product._id,
    pizzaSizeId: small.id,
    price: 1.75,
    stockUnitsConsumed: 4,
  });
  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: small.id, price: 1.75, stockUnitsConsumed: 4 },
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ]);
});

test('updateComponentSizeConfiguration accepts a price of zero and works without stock control', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(OREGANO);
  await createComponentSizeConfiguration(product._id, { pizzaSizeId: small.id, price: 0.5 }, repos);

  const updated = await updateComponentSizeConfiguration(product._id, small.id, { price: 0 }, repos);

  assert.equal(updated.price, 0);
  assert.equal(updated.stockUnitsConsumed, null);
});

test('updateComponentSizeConfiguration rejects invalid data without changing the configuration', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );

  const invalidData = [
    undefined,
    {},
    { stockUnitsConsumed: 2 },
    { price: -1, stockUnitsConsumed: 2 },
    { price: '2', stockUnitsConsumed: 2 },
    { price: 2 },
    { price: 2, stockUnitsConsumed: null },
    { price: 2, stockUnitsConsumed: 0 },
    { price: 2, stockUnitsConsumed: 1.5 },
  ];

  for (const data of invalidData) {
    await assert.rejects(
      async () => await updateComponentSizeConfiguration(product._id, small.id, data, repos),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
  ]);
});

test('updateComponentSizeConfiguration does not accept stock units for components without stock control', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(OREGANO);
  await createComponentSizeConfiguration(product._id, { pizzaSizeId: small.id, price: 0.5 }, repos);

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        product._id,
        small.id,
        { price: 1, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 400 && /stock controlled/i.test(err.message),
  );

  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: small.id, price: 0.5, stockUnitsConsumed: null },
  ]);
});

test('updateComponentSizeConfiguration rejects a product that stopped being a pizza component', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await productsRepository.update(product._id, { pizzaComponentTypeId: null });

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        product._id,
        small.id,
        { price: 2, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 400 && /pizza component/i.test(err.message),
  );
});

test('updateComponentSizeConfiguration throws 404 if the product does not exist or is inactive', async () => {
  const { repos, productsRepository, small } = await setup();
  const data = { price: 2, stockUnitsConsumed: 2 };

  await assert.rejects(
    async () => await updateComponentSizeConfiguration(NON_EXISTENT_ID, small.id, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await productsRepository.update(product._id, { isActive: false });

  await assert.rejects(
    async () => await updateComponentSizeConfiguration(product._id, small.id, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );
  assert.equal((await configurationsOf(productsRepository, product._id))[0].price, 1);
});

test('updateComponentSizeConfiguration throws 404 if the size is not configured', async () => {
  const { repos, productsRepository, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        product._id,
        large.id,
        { price: 2, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );

  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('updateComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        product._id,
        small.id,
        { price: 2, stockUnitsConsumed: 2 },
        withNullOperation(repos, 'updateSizeConfiguration'),
      ),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('updateComponentSizeConfiguration validates the data before looking for the product', async () => {
  const { repos, small } = await setup();

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        NON_EXISTENT_ID,
        small.id,
        { price: -1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
});

test('removeComponentSizeConfiguration removes the configuration and returns it', async () => {
  const { repos, productsRepository, small, large } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
    repos,
  );

  const removed = await removeComponentSizeConfiguration(product._id, small.id, repos);

  assert.deepEqual(removed, {
    productId: product._id,
    pizzaSizeId: small.id,
    price: 1,
    stockUnitsConsumed: 1,
  });
  // Only the removed size is gone
  assert.deepEqual(await configurationsOf(productsRepository, product._id), [
    { pizzaSizeId: large.id, price: 2, stockUnitsConsumed: 2 },
  ]);
  await assert.rejects(
    async () => await getComponentSizeConfiguration(product._id, small.id, repos),
    (err) => err.status === 404,
  );
});

test('removeComponentSizeConfiguration also works for an inactive product', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await productsRepository.update(product._id, { isActive: false });

  const removed = await removeComponentSizeConfiguration(product._id, small.id, repos);

  assert.equal(removed.price, 1);
  assert.equal((await configurationsOf(productsRepository, product._id)).length, 0);
});

test('removeComponentSizeConfiguration throws 404 if the product or the configuration does not exist', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(NON_EXISTENT_ID, small.id, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(product._id, small.id, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('removeComponentSizeConfiguration throws 404 if the configuration was already removed', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await removeComponentSizeConfiguration(product._id, small.id, repos);

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(product._id, small.id, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('removeComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );

  await assert.rejects(
    async () =>
      await removeComponentSizeConfiguration(
        product._id,
        small.id,
        withNullOperation(repos, 'removeSizeConfiguration'),
      ),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('removing a configuration frees the pizza size to be configured again', async () => {
  const { repos, productsRepository, small } = await setup();
  const product = await productsRepository.create(MOZZARELLA);
  await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 1, stockUnitsConsumed: 1 },
    repos,
  );
  await removeComponentSizeConfiguration(product._id, small.id, repos);

  const created = await createComponentSizeConfiguration(
    product._id,
    { pizzaSizeId: small.id, price: 3, stockUnitsConsumed: 5 },
    repos,
  );

  assert.equal(created.price, 3);
  assert.equal(created.stockUnitsConsumed, 5);
});