import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import {
  listCatalogue,
  getCatalogueItemById,
  toCatalogueDTO,
} from '../../src/application/product-catalogue/product-catalogue.service.js';

test('toCatalogueDTO maps fields correctly', () => {
  const product = {
    _id: 'prod1',
    name: 'Pizza Margherita',
    description: 'Classic',
    price: 10,
    categoryId: { _id: 'cat1', name: 'Pizzas' },
    allergenIds: [{ _id: 'all1', name: 'Gluten' }],
    sizeConfigurations: [{ pizzaSizeId: 'size1', price: 12 }],
  };

  const dto = toCatalogueDTO(product);

  assert.equal(dto.id, 'prod1');
  assert.equal(dto.name, 'Pizza Margherita');
  assert.equal(dto.description, 'Classic');
  assert.equal(dto.price, 10);
  assert.deepEqual(dto.category, { id: 'cat1', name: 'Pizzas' });
  assert.deepEqual(dto.allergens, [{ id: 'all1', name: 'Gluten' }]);
  assert.deepEqual(dto.availableSizes, [{ pizzaSizeId: 'size1', price: 12 }]);
});

test('toCatalogueDTO maps safely when optional fields are missing', () => {
  const product = {
    _id: 'prod2',
    name: 'Agua',
    description: 'Bebida',
    price: 1.5,
  };

  const dto = toCatalogueDTO(product);

  assert.equal(dto.category, null);
  assert.deepEqual(dto.allergens, []);
  assert.deepEqual(dto.availableSizes, []);
});

const P1_ID = 'e0e0e0000000000000000001';
const P2_ID = 'e0e0e0000000000000000002';

test('listCatalogue returns only active and sellable products', async () => {
  const productsRepository = {
    listProducts: mock.fn(async () => [{ _id: P1_ID, name: 'P1', sellable: true, isActive: true }]),
  };

  const list = await listCatalogue({}, { productsRepository });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'P1');
  assert.deepEqual(productsRepository.listProducts.mock.calls[0].arguments[0], {
    isActive: true,
    sellable: true,
  });
});

test('getCatalogueItemById returns DTO for active and sellable product', async () => {
  const productsRepository = {
    findById: mock.fn(async () => ({ _id: P1_ID, name: 'P1', sellable: true, isActive: true })),
  };

  const item = await getCatalogueItemById(P1_ID, { productsRepository });

  assert.equal(item.name, 'P1');
  assert.equal(productsRepository.findById.mock.calls[0].arguments[0], P1_ID);
});

test('getCatalogueItemById throws 404 for inactive, non-sellable or missing products', async () => {
  const products = [
    { _id: P1_ID, name: 'P1', sellable: false, isActive: true },
    { _id: P2_ID, name: 'P2', sellable: true, isActive: false },
  ];
  const productsRepository = {
    findById: mock.fn(async (id) => products.find((p) => p._id === id) ?? null),
  };

  await assert.rejects(
    async () => await getCatalogueItemById(P1_ID, { productsRepository }),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getCatalogueItemById(P2_ID, { productsRepository }),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getCatalogueItemById('invalid_id', { productsRepository }),
    (err) => err instanceof AppError && err.status === 404,
  );
  assert.equal(productsRepository.findById.mock.callCount(), 3);
});
