import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
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

test('listCatalogue returns only active and sellable products', async () => {
  const productsRepo = createDummyProductsRepository();
  await productsRepo.create({ name: 'P1', sellable: true, isActive: true });
  await productsRepo.create({ name: 'P2', sellable: false, isActive: true });
  await productsRepo.create({ name: 'P3', sellable: true, isActive: false });

  const list = await listCatalogue({}, { productsRepository: productsRepo });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'P1');
});

test('getCatalogueItemById returns DTO for active and sellable product', async () => {
  const productsRepo = createDummyProductsRepository();
  const p1 = await productsRepo.create({ name: 'P1', sellable: true, isActive: true });

  const item = await getCatalogueItemById(p1._id, { productsRepository: productsRepo });

  assert.equal(item.name, 'P1');
});

test('getCatalogueItemById throws 404 for inactive, non-sellable or missing products', async () => {
  const productsRepo = createDummyProductsRepository();
  const p1 = await productsRepo.create({ name: 'P1', sellable: false, isActive: true });
  const p2 = await productsRepo.create({ name: 'P2', sellable: true, isActive: false });

  await assert.rejects(
    async () => await getCatalogueItemById(p1._id, { productsRepository: productsRepo }),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getCatalogueItemById(p2._id, { productsRepository: productsRepo }),
    (err) => err instanceof AppError && err.status === 404,
  );

  await assert.rejects(
    async () => await getCatalogueItemById('invalid_id', { productsRepository: productsRepo }),
    (err) => err instanceof AppError && err.status === 404,
  );
});
