import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import { getStockByProductId, adjustStock } from '../../src/application/stock/stock.service.js';

const PRODUCT_WITH_STOCK_ID = 'e0e0e0000000000000000001';
const PRODUCT_NO_STOCK_ID = 'e0e0e0000000000000000002';
const STOCK_ID = 'f0f0f0000000000000000001';

const prodWithStock = {
  _id: PRODUCT_WITH_STOCK_ID,
  name: 'Com Stock',
  description: 'Teste',
  stockControlled: true,
  isActive: true,
};
const prodNoStock = {
  _id: PRODUCT_NO_STOCK_ID,
  name: 'Sem Stock',
  description: 'Teste',
  stockControlled: false,
  isActive: true,
};

/** Products mock: resolves only the two known products. */
const createProductsRepository = () => ({
  findById: mock.fn(async (id) =>
    [prodWithStock, prodNoStock].find((p) => String(p._id) === String(id)) ?? null,
  ),
});

test('getStockByProductId rejects products that are not stock controlled or non-existent', async () => {
  const repos = {
    productsRepository: createProductsRepository(),
    stockRepository: { findByProductId: mock.fn(), create: mock.fn() },
  };

  await assert.rejects(
    async () => await getStockByProductId('id_inexistente', repos),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getStockByProductId(PRODUCT_NO_STOCK_ID, repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('not stock controlled'),
  );
  assert.equal(repos.stockRepository.findByProductId.mock.callCount(), 0);
  assert.equal(repos.stockRepository.create.mock.callCount(), 0);
});

test('getStockByProductId creates stock lazily at 0 if it does not exist', async () => {
  const repos = {
    productsRepository: createProductsRepository(),
    stockRepository: {
      findByProductId: mock.fn(async () => null),
      create: mock.fn(async (data) => ({ _id: STOCK_ID, ...data })),
    },
  };

  const stock = await getStockByProductId(PRODUCT_WITH_STOCK_ID, repos);

  assert.equal(stock.quantity, 0);
  assert.equal(repos.stockRepository.create.mock.callCount(), 1);
  assert.deepEqual(repos.stockRepository.create.mock.calls[0].arguments[0], {
    productId: PRODUCT_WITH_STOCK_ID,
    quantity: 0,
  });
});

test('adjustStock correctly increases and decreases stock, preventing negative values', async () => {
  const repos = {
    productsRepository: createProductsRepository(),
    stockRepository: {
      findByProductId: mock.fn(async () => null),
      create: mock.fn(async (data) => ({ _id: STOCK_ID, ...data })),
      updateQuantity: mock.fn(async (productId, quantity) => ({
        _id: STOCK_ID,
        productId,
        quantity,
      })),
    },
  };

  // 1st step: no stock yet -> created at 0 and increased to 10.
  const increased = await adjustStock(PRODUCT_WITH_STOCK_ID, 10, 'increase', repos);
  assert.equal(increased.quantity, 10);
  assert.equal(repos.stockRepository.create.mock.callCount(), 1);
  assert.deepEqual(repos.stockRepository.updateQuantity.mock.calls[0].arguments, [
    PRODUCT_WITH_STOCK_ID,
    10,
  ]);

  // 2nd step: stock at 10 -> decreased to 6.
  repos.stockRepository.findByProductId.mock.mockImplementation(async () => ({
    _id: STOCK_ID,
    productId: PRODUCT_WITH_STOCK_ID,
    quantity: 10,
  }));
  const decreased = await adjustStock(PRODUCT_WITH_STOCK_ID, 4, 'decrease', repos);
  assert.equal(decreased.quantity, 6);
  assert.equal(repos.stockRepository.updateQuantity.mock.calls[1].arguments[1], 6);

  // 3rd step: stock at 6 -> decreasing 10 would go negative and must not be persisted.
  repos.stockRepository.findByProductId.mock.mockImplementation(async () => ({
    _id: STOCK_ID,
    productId: PRODUCT_WITH_STOCK_ID,
    quantity: 6,
  }));
  await assert.rejects(
    async () => await adjustStock(PRODUCT_WITH_STOCK_ID, 10, 'decrease', repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('negative quantity'),
  );
  assert.equal(repos.stockRepository.updateQuantity.mock.callCount(), 2);

  const current = await getStockByProductId(PRODUCT_WITH_STOCK_ID, repos);
  assert.equal(current.quantity, 6);
  assert.equal(repos.stockRepository.create.mock.callCount(), 1);
});

test('adjustStock rejects invalid operations and non-stock controlled products', async () => {
  const repos = {
    productsRepository: createProductsRepository(),
    stockRepository: {
      findByProductId: mock.fn(async () => ({
        _id: STOCK_ID,
        productId: PRODUCT_WITH_STOCK_ID,
        quantity: 0,
      })),
      create: mock.fn(),
      updateQuantity: mock.fn(),
    },
  };

  await assert.rejects(
    async () => await adjustStock(PRODUCT_NO_STOCK_ID, 5, 'increase', repos),
    (err) => err instanceof AppError && err.status === 400,
  );

  await assert.rejects(
    async () => await adjustStock(PRODUCT_WITH_STOCK_ID, 5, 'invalid_op', repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('Invalid operation'),
  );
  assert.equal(repos.stockRepository.updateQuantity.mock.callCount(), 0);
});
