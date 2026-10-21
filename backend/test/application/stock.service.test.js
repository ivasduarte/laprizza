import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyStockRepository } from '../infrastructure/stock.dummy.repository.js';
import { getStockByProductId, adjustStock } from '../../src/application/stock/stock.service.js';

async function setupRepos() {
  const productsRepo = createDummyProductsRepository();
  const stockRepo = createDummyStockRepository();

  const prodWithStock = await productsRepo.create({
    name: 'Com Stock',
    description: 'Teste',
    stockControlled: true,
  });

  const prodNoStock = await productsRepo.create({
    name: 'Sem Stock',
    description: 'Teste',
    stockControlled: false,
  });

  return {
    repos: { productsRepository: productsRepo, stockRepository: stockRepo },
    prodWithStock,
    prodNoStock,
  };
}

test('getStockByProductId rejects products that are not stock controlled or non-existent', async () => {
  const { repos, prodNoStock } = await setupRepos();

  await assert.rejects(
    async () => await getStockByProductId('id_inexistente', repos),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getStockByProductId(prodNoStock._id, repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('not stock controlled'),
  );
});

test('getStockByProductId creates stock lazily at 0 if it does not exist', async () => {
  const { repos, prodWithStock } = await setupRepos();

  assert.equal(repos.stockRepository._getStocks().length, 0);

  const stock = await getStockByProductId(prodWithStock._id, repos);

  assert.equal(stock.quantity, 0);
  assert.equal(repos.stockRepository._getStocks().length, 1);
});

test('adjustStock correctly increases and decreases stock, preventing negative values', async () => {
  const { repos, prodWithStock } = await setupRepos();

  const increased = await adjustStock(prodWithStock._id, 10, 'increase', repos);
  assert.equal(increased.quantity, 10);

  const decreased = await adjustStock(prodWithStock._id, 4, 'decrease', repos);
  assert.equal(decreased.quantity, 6);

  await assert.rejects(
    async () => await adjustStock(prodWithStock._id, 10, 'decrease', repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('negative quantity'),
  );

  const current = await getStockByProductId(prodWithStock._id, repos);
  assert.equal(current.quantity, 6);
});

test('adjustStock rejects invalid operations and non-stock controlled products', async () => {
  const { repos, prodWithStock, prodNoStock } = await setupRepos();

  await assert.rejects(
    async () => await adjustStock(prodNoStock._id, 5, 'increase', repos),
    (err) => err instanceof AppError && err.status === 400,
  );

  await assert.rejects(
    async () => await adjustStock(prodWithStock._id, 5, 'invalid_op', repos),
    (err) =>
      err instanceof AppError && err.status === 400 && err.message.includes('Invalid operation'),
  );
});
