import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
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
const PRODUCT_ID = 'e0e0e0000000000000000001';
const SMALL_ID = 'd0d0d0000000000000000001';
const LARGE_ID = 'd0d0d0000000000000000002';

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
const COLA = { name: 'Cola', description: 'Drink', stockControlled: false, pizzaComponentTypeId: null };

const SMALL_CONFIG = { pizzaSizeId: SMALL_ID, price: 1, stockUnitsConsumed: 1 };
const LARGE_CONFIG = { pizzaSizeId: LARGE_ID, price: 2, stockUnitsConsumed: 2 };

/** Stored product document with the given size configurations. */
const storedProduct = (base, sizeConfigurations = [], extra = {}) => ({
  _id: PRODUCT_ID,
  isActive: true,
  ...base,
  sizeConfigurations,
  ...extra,
});

const isForSize = (pizzaSizeId) => (c) => String(c.pizzaSizeId) === String(pizzaSizeId);

/**
 * Mocked repositories. productsRepository.findById returns `product`; the write operations return
 * the product with the change applied (as the real atomic updates do). The pizza sizes Small and
 * Large exist and are active, unless `sizes` says otherwise.
 */
function setup({
  product = null,
  sizes = [
    { _id: SMALL_ID, name: 'Small', isActive: true },
    { _id: LARGE_ID, name: 'Large', isActive: true },
  ],
} = {}) {
  const productsRepository = {
    findById: mock.fn(async (id) => (product && String(id) === String(product._id) ? product : null)),
    addSizeConfiguration: mock.fn(async (_productId, configuration) => ({
      ...product,
      sizeConfigurations: [...product.sizeConfigurations, { ...configuration }],
    })),
    updateSizeConfiguration: mock.fn(async (_productId, pizzaSizeId, { price, stockUnitsConsumed }) => ({
      ...product,
      sizeConfigurations: product.sizeConfigurations.map((c) =>
        isForSize(pizzaSizeId)(c) ? { ...c, price, stockUnitsConsumed } : c,
      ),
    })),
    removeSizeConfiguration: mock.fn(async (_productId, pizzaSizeId) => ({
      ...product,
      sizeConfigurations: product.sizeConfigurations.filter((c) => !isForSize(pizzaSizeId)(c)),
    })),
  };
  const sizeRepository = {
    findById: mock.fn(async (id) => sizes.find((s) => String(s._id) === String(id)) ?? null),
  };

  return { productsRepository, sizeRepository, repos: { productsRepository, sizeRepository } };
}

/** Asserts that no write operation reached the products repository. */
function assertNothingWritten(productsRepository) {
  assert.equal(productsRepository.addSizeConfiguration.mock.callCount(), 0);
  assert.equal(productsRepository.updateSizeConfiguration.mock.callCount(), 0);
  assert.equal(productsRepository.removeSizeConfiguration.mock.callCount(), 0);
}

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
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });

  const created = await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: SMALL_ID, price: 2.5, stockUnitsConsumed: 3 },
    repos,
  );

  assert.deepEqual(created, {
    productId: PRODUCT_ID,
    pizzaSizeId: SMALL_ID,
    price: 2.5,
    stockUnitsConsumed: 3,
  });
  assert.deepEqual(productsRepository.addSizeConfiguration.mock.calls[0].arguments, [
    PRODUCT_ID,
    { pizzaSizeId: SMALL_ID, price: 2.5, stockUnitsConsumed: 3 },
  ]);
});

test('createComponentSizeConfiguration saves a component without stock control without stock units', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(OREGANO) });

  const omitted = await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: SMALL_ID, price: 0.5 },
    repos,
  );
  assert.equal(omitted.stockUnitsConsumed, null);

  const explicitNull = await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: LARGE_ID, price: 1, stockUnitsConsumed: null },
    repos,
  );
  assert.equal(explicitNull.stockUnitsConsumed, null);
  assert.deepEqual(
    productsRepository.addSizeConfiguration.mock.calls.map((c) => c.arguments[1].stockUnitsConsumed),
    [null, null],
  );
});

test('createComponentSizeConfiguration accepts a price of zero', async () => {
  const { repos } = setup({ product: storedProduct(OREGANO) });

  const created = await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: SMALL_ID, price: 0 },
    repos,
  );

  assert.equal(created.price, 0);
});

test('createComponentSizeConfiguration allows several sizes for the same component and the same size for several components', async () => {
  const OREGANO_ID = 'e0e0e0000000000000000002';
  const products = {
    [PRODUCT_ID]: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
    [OREGANO_ID]: storedProduct(OREGANO, [], { _id: OREGANO_ID }),
  };
  const { repos, productsRepository } = setup();
  productsRepository.findById.mock.mockImplementation(async (id) => products[id] ?? null);
  productsRepository.addSizeConfiguration.mock.mockImplementation(async (id, configuration) => ({
    ...products[id],
    sizeConfigurations: [...products[id].sizeConfigurations, configuration],
  }));

  // Mozzarella already has Small: Large can be added
  await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: LARGE_ID, price: 2, stockUnitsConsumed: 2 },
    repos,
  );
  // Small is also accepted for another component
  await createComponentSizeConfiguration(OREGANO_ID, { pizzaSizeId: SMALL_ID, price: 0.5 }, repos);

  assert.deepEqual(
    productsRepository.addSizeConfiguration.mock.calls.map((c) => [c.arguments[0], c.arguments[1].pizzaSizeId]),
    [
      [PRODUCT_ID, LARGE_ID],
      [OREGANO_ID, SMALL_ID],
    ],
  );
});

test('createComponentSizeConfiguration rejects invalid data without saving', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });

  const invalidData = [
    undefined,
    {},
    { pizzaSizeId: SMALL_ID, stockUnitsConsumed: 1 },
    { pizzaSizeId: SMALL_ID, price: -1, stockUnitsConsumed: 1 },
    { pizzaSizeId: SMALL_ID, price: '2', stockUnitsConsumed: 1 },
    { pizzaSizeId: SMALL_ID, price: NaN, stockUnitsConsumed: 1 },
    { pizzaSizeId: SMALL_ID, price: null, stockUnitsConsumed: 1 },
    { price: 2, stockUnitsConsumed: 1 },
    { pizzaSizeId: '   ', price: 2, stockUnitsConsumed: 1 },
    { pizzaSizeId: 123, price: 2, stockUnitsConsumed: 1 },
  ];

  for (const data of invalidData) {
    await assert.rejects(
      async () => await createComponentSizeConfiguration(PRODUCT_ID, data, repos),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration requires stock units for stock controlled components', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });

  for (const stockUnitsConsumed of [undefined, null, 0, -1, 1.5, '2']) {
    await assert.rejects(
      async () =>
        await createComponentSizeConfiguration(
          PRODUCT_ID,
          { pizzaSizeId: SMALL_ID, price: 2, stockUnitsConsumed },
          repos,
        ),
      (err) => err.status === 400 && /stock units consumed/i.test(err.message),
      String(stockUnitsConsumed),
    );
  }

  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration does not accept stock units for components without stock control', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(OREGANO) });

  for (const stockUnitsConsumed of [0, 1, 5]) {
    await assert.rejects(
      async () =>
        await createComponentSizeConfiguration(
          PRODUCT_ID,
          { pizzaSizeId: SMALL_ID, price: 2, stockUnitsConsumed },
          repos,
        ),
      (err) => err.status === 400 && /stock controlled/i.test(err.message),
      String(stockUnitsConsumed),
    );
  }

  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration rejects products that are not pizza components', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(COLA) });

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(PRODUCT_ID, { pizzaSizeId: SMALL_ID, price: 2 }, repos),
    (err) => err.status === 400 && /pizza component/i.test(err.message),
  );

  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration throws 404 if the product does not exist or is inactive', async () => {
  const data = { pizzaSizeId: SMALL_ID, price: 1, stockUnitsConsumed: 1 };
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [], { isActive: false }),
  });

  await assert.rejects(
    async () => await createComponentSizeConfiguration(NON_EXISTENT_ID, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  await assert.rejects(
    async () => await createComponentSizeConfiguration(PRODUCT_ID, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration throws 404 if the pizza size does not exist or is inactive', async () => {
  const { repos, productsRepository, sizeRepository } = setup({
    product: storedProduct(MOZZARELLA),
    sizes: [{ _id: SMALL_ID, name: 'Small', isActive: false }],
  });

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        PRODUCT_ID,
        { pizzaSizeId: NON_EXISTENT_ID, price: 1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 404 && /pizza size/i.test(err.message),
  );

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        PRODUCT_ID,
        { pizzaSizeId: SMALL_ID, price: 1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 404 && /pizza size/i.test(err.message),
  );

  assert.deepEqual(
    sizeRepository.findById.mock.calls.map((c) => c.arguments[0]),
    [NON_EXISTENT_ID, SMALL_ID],
  );
  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration returns 409 Conflict if the size is already configured', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        PRODUCT_ID,
        { pizzaSizeId: SMALL_ID, price: 9, stockUnitsConsumed: 9 },
        repos,
      ),
    (err) => err.status === 409 && /already exists/i.test(err.message),
  );

  // The existing configuration is kept as it was
  assertNothingWritten(productsRepository);
});

test('createComponentSizeConfiguration returns 409 Conflict if another request configured the size in the meantime', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });
  // The atomic update reports that nothing was changed (null).
  productsRepository.addSizeConfiguration.mock.mockImplementation(async () => null);

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        PRODUCT_ID,
        { pizzaSizeId: SMALL_ID, price: 1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 409 && /already exists/i.test(err.message),
  );
  assert.equal(productsRepository.addSizeConfiguration.mock.callCount(), 1);
});

test('createComponentSizeConfiguration validates the data before looking for the product', async () => {
  const { repos, productsRepository } = setup();

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        NON_EXISTENT_ID,
        { pizzaSizeId: SMALL_ID, price: -1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
  assert.equal(productsRepository.findById.mock.callCount(), 0);
});

test('createComponentSizeConfiguration checks the product is a pizza component before looking for the pizza size', async () => {
  const { repos, sizeRepository } = setup({ product: storedProduct(COLA) });

  await assert.rejects(
    async () =>
      await createComponentSizeConfiguration(
        PRODUCT_ID,
        { pizzaSizeId: NON_EXISTENT_ID, price: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
  assert.equal(sizeRepository.findById.mock.callCount(), 0);
});

test('listComponentSizeConfigurations returns the configurations of the product', async () => {
  const { repos } = setup({ product: storedProduct(MOZZARELLA, [SMALL_CONFIG, LARGE_CONFIG]) });

  const list = await listComponentSizeConfigurations(PRODUCT_ID, repos);

  assert.deepEqual(list, [
    { productId: PRODUCT_ID, ...SMALL_CONFIG },
    { productId: PRODUCT_ID, ...LARGE_CONFIG },
  ]);
});

test('listComponentSizeConfigurations returns an empty list for a product without configurations', async () => {
  const { repos } = setup({ product: storedProduct(MOZZARELLA) });

  assert.deepEqual(await listComponentSizeConfigurations(PRODUCT_ID, repos), []);
});

test('listComponentSizeConfigurations also works for an inactive product', async () => {
  const { repos } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG], { isActive: false }),
  });

  assert.equal((await listComponentSizeConfigurations(PRODUCT_ID, repos)).length, 1);
});

test('listComponentSizeConfigurations throws 404 if the product does not exist', async () => {
  const { repos } = setup();

  await assert.rejects(
    async () => await listComponentSizeConfigurations(NON_EXISTENT_ID, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );
});

test('getComponentSizeConfiguration returns the configuration of the pizza size', async () => {
  const { repos } = setup({ product: storedProduct(MOZZARELLA, [SMALL_CONFIG, LARGE_CONFIG]) });

  const found = await getComponentSizeConfiguration(PRODUCT_ID, LARGE_ID, repos);

  assert.deepEqual(found, {
    productId: PRODUCT_ID,
    pizzaSizeId: LARGE_ID,
    price: 2,
    stockUnitsConsumed: 2,
  });
});

test('getComponentSizeConfiguration also works for an inactive product', async () => {
  const { repos } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG], { isActive: false }),
  });

  const found = await getComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos);

  assert.equal(found.price, 1);
});

test('getComponentSizeConfiguration throws 404 if the product or the configuration does not exist', async () => {
  const { repos } = setup({ product: storedProduct(MOZZARELLA, [SMALL_CONFIG]) });

  await assert.rejects(
    async () => await getComponentSizeConfiguration(NON_EXISTENT_ID, SMALL_ID, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  // Existing size, but not configured for this component
  await assert.rejects(
    async () => await getComponentSizeConfiguration(PRODUCT_ID, LARGE_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );

  await assert.rejects(
    async () => await getComponentSizeConfiguration(PRODUCT_ID, NON_EXISTENT_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('updateComponentSizeConfiguration changes the price and the stock units', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG, LARGE_CONFIG]),
  });

  const updated = await updateComponentSizeConfiguration(
    PRODUCT_ID,
    SMALL_ID,
    { price: 1.75, stockUnitsConsumed: 4 },
    repos,
  );

  assert.deepEqual(updated, {
    productId: PRODUCT_ID,
    pizzaSizeId: SMALL_ID,
    price: 1.75,
    stockUnitsConsumed: 4,
  });
  assert.deepEqual(productsRepository.updateSizeConfiguration.mock.calls[0].arguments, [
    PRODUCT_ID,
    SMALL_ID,
    { price: 1.75, stockUnitsConsumed: 4 },
  ]);
});

test('updateComponentSizeConfiguration accepts a price of zero and works without stock control', async () => {
  const { repos } = setup({
    product: storedProduct(OREGANO, [{ pizzaSizeId: SMALL_ID, price: 0.5, stockUnitsConsumed: null }]),
  });

  const updated = await updateComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, { price: 0 }, repos);

  assert.equal(updated.price, 0);
  assert.equal(updated.stockUnitsConsumed, null);
});

test('updateComponentSizeConfiguration rejects invalid data without changing the configuration', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });

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
      async () => await updateComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, data, repos),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assertNothingWritten(productsRepository);
});

test('updateComponentSizeConfiguration does not accept stock units for components without stock control', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(OREGANO, [{ pizzaSizeId: SMALL_ID, price: 0.5, stockUnitsConsumed: null }]),
  });

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        PRODUCT_ID,
        SMALL_ID,
        { price: 1, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 400 && /stock controlled/i.test(err.message),
  );

  assertNothingWritten(productsRepository);
});

test('updateComponentSizeConfiguration rejects a product that stopped being a pizza component', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG], { pizzaComponentTypeId: null }),
  });

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        PRODUCT_ID,
        SMALL_ID,
        { price: 2, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 400 && /pizza component/i.test(err.message),
  );
  assertNothingWritten(productsRepository);
});

test('updateComponentSizeConfiguration throws 404 if the product does not exist or is inactive', async () => {
  const data = { price: 2, stockUnitsConsumed: 2 };
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG], { isActive: false }),
  });

  await assert.rejects(
    async () => await updateComponentSizeConfiguration(NON_EXISTENT_ID, SMALL_ID, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  await assert.rejects(
    async () => await updateComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, data, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );
  assertNothingWritten(productsRepository);
});

test('updateComponentSizeConfiguration throws 404 if the size is not configured', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        PRODUCT_ID,
        LARGE_ID,
        { price: 2, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );

  assertNothingWritten(productsRepository);
});

test('updateComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });
  // The atomic update reports that nothing was changed (null).
  productsRepository.updateSizeConfiguration.mock.mockImplementation(async () => null);

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        PRODUCT_ID,
        SMALL_ID,
        { price: 2, stockUnitsConsumed: 2 },
        repos,
      ),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('updateComponentSizeConfiguration validates the data before looking for the product', async () => {
  const { repos, productsRepository } = setup();

  await assert.rejects(
    async () =>
      await updateComponentSizeConfiguration(
        NON_EXISTENT_ID,
        SMALL_ID,
        { price: -1, stockUnitsConsumed: 1 },
        repos,
      ),
    (err) => err.status === 400,
  );
  assert.equal(productsRepository.findById.mock.callCount(), 0);
});

test('removeComponentSizeConfiguration removes the configuration and returns it', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG, LARGE_CONFIG]),
  });

  const removed = await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos);

  assert.deepEqual(removed, {
    productId: PRODUCT_ID,
    pizzaSizeId: SMALL_ID,
    price: 1,
    stockUnitsConsumed: 1,
  });
  // Only the removed size is targeted
  assert.deepEqual(productsRepository.removeSizeConfiguration.mock.calls[0].arguments, [
    PRODUCT_ID,
    SMALL_ID,
  ]);

  // Next step: the stored product only has the Large configuration left.
  productsRepository.findById.mock.mockImplementation(async () =>
    storedProduct(MOZZARELLA, [LARGE_CONFIG]),
  );
  await assert.rejects(
    async () => await getComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos),
    (err) => err.status === 404,
  );
});

test('removeComponentSizeConfiguration also works for an inactive product', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG], { isActive: false }),
  });

  const removed = await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos);

  assert.equal(removed.price, 1);
  assert.equal(productsRepository.removeSizeConfiguration.mock.callCount(), 1);
});

test('removeComponentSizeConfiguration throws 404 if the product or the configuration does not exist', async () => {
  const { repos, productsRepository } = setup({ product: storedProduct(MOZZARELLA) });

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(NON_EXISTENT_ID, SMALL_ID, repos),
    (err) => err.status === 404 && /product/i.test(err.message),
  );

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
  assertNothingWritten(productsRepository);
});

test('removeComponentSizeConfiguration throws 404 if the configuration was already removed', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });
  await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos);

  // Next step: the stored product no longer has the configuration.
  productsRepository.findById.mock.mockImplementation(async () => storedProduct(MOZZARELLA));

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
  assert.equal(productsRepository.removeSizeConfiguration.mock.callCount(), 1);
});

test('removeComponentSizeConfiguration throws 404 if the configuration disappeared in the meantime', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });
  // The atomic update reports that nothing was changed (null).
  productsRepository.removeSizeConfiguration.mock.mockImplementation(async () => null);

  await assert.rejects(
    async () => await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos),
    (err) => err.status === 404 && /configuration/i.test(err.message),
  );
});

test('removing a configuration frees the pizza size to be configured again', async () => {
  const { repos, productsRepository } = setup({
    product: storedProduct(MOZZARELLA, [SMALL_CONFIG]),
  });
  await removeComponentSizeConfiguration(PRODUCT_ID, SMALL_ID, repos);

  // Next step: the stored product has no configuration for Small any more.
  const withoutConfigurations = storedProduct(MOZZARELLA);
  productsRepository.findById.mock.mockImplementation(async () => withoutConfigurations);
  productsRepository.addSizeConfiguration.mock.mockImplementation(async (_id, configuration) => ({
    ...withoutConfigurations,
    sizeConfigurations: [configuration],
  }));

  const created = await createComponentSizeConfiguration(
    PRODUCT_ID,
    { pizzaSizeId: SMALL_ID, price: 3, stockUnitsConsumed: 5 },
    repos,
  );

  assert.equal(created.price, 3);
  assert.equal(created.stockUnitsConsumed, 5);
});
