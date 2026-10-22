import test from 'node:test';
import assert from 'node:assert/strict';
import { createDummyProductCategoriesRepository } from '../infrastructure/product-categories.dummy.repository.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import {
  listProductCategories,
  createProductCategory,
  getProductCategoryById,
  updateProductCategory,
  removeProductCategory,
} from '../../src/application/product-categories/product-categories.service.js';


// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';

test('createProductCategory saves a normalized name and returns a DTO', async () => {
  const dummyRepo = createDummyProductCategoriesRepository();

  const created = await createProductCategory({ name: '  Soft   Drinks' }, dummyRepo);

  assert.equal(dummyRepo._getCategories().length, 1);
  assert.ok(created.id);
  assert.equal(created.name, 'Soft Drinks');
  assert.equal(created._id, undefined);
});

test('createProductCategory rejects blank or missing names without saving', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();

  await assert.rejects(
    async () => await createProductCategory({ name: '   ' }, categoriesRepo),
    (err) => err.status === 400,
  );
  await assert.rejects(
    async () => await createProductCategory({}, categoriesRepo),
    (err) => err.status === 400,
  );

  assert.equal(categoriesRepo._getCategories().length, 0);
});

test('createProductCategory returns 409 Conflict on duplicate name', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  await createProductCategory({ name: 'Café' }, categoriesRepo);

  await assert.rejects(
    async () => await createProductCategory({ name: 'CAFE' }, categoriesRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo._getCategories().length, 1);
});

test('listProductCategories without a name returns all categories', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  const categories = await listProductCategories(undefined, categoriesRepo);

  assert.ok(Array.isArray(categories));
  assert.equal(categories.length, 2);
  assert.ok(categories[0].id);
  assert.equal(categories[0]._id, undefined);
});

test('listProductCategories finds the exact name ignoring case and accents', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  await createProductCategory({ name: 'Café' }, categoriesRepo);
  await createProductCategory({ name: 'Pizzas' }, categoriesRepo);

  const found = await listProductCategories('cafe', categoriesRepo);

  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Café');
});

test('listProductCategories returns an empty list for partial or blank names', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  assert.deepEqual(await listProductCategories('bever', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('Beb', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('   ', categoriesRepo), []);
});

test('getProductCategoryById returns the category or throws 404', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);

  const found = await getProductCategoryById(created.id, categoriesRepo);
  assert.equal(found.name, 'Pizzas');

  await assert.rejects(
    async () => await getProductCategoryById(NON_EXISTENT_ID, categoriesRepo),
    (err) => err.status === 404,
  );
});

test('updateProductCategory changes the name', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const created = await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  const updated = await updateProductCategory(
    created.id,
    { name: '  Soft   Drinks ' },
    categoriesRepo,
  );

  assert.equal(updated.id, created.id);
  assert.equal(updated.name, 'Soft Drinks');
  assert.equal(categoriesRepo._getCategories()[0].name, 'Soft Drinks');
});

test('updateProductCategory allows changing only the case of its own name', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const created = await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  const updated = await updateProductCategory(created.id, { name: 'bebidas' }, categoriesRepo);

  assert.equal(updated.name, 'bebidas');
});

test('updateProductCategory rejects blank names', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const created = await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  await assert.rejects(
    async () => await updateProductCategory(created.id, { name: '  ' }, categoriesRepo),
    (err) => err.status === 400,
  );

  assert.equal(categoriesRepo._getCategories()[0].name, 'Bebidas');
});

test('updateProductCategory returns 409 Conflict on duplicate name', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  const drinks = await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  await assert.rejects(
    async () => await updateProductCategory(drinks.id, { name: 'PIZZAS' }, categoriesRepo),
    (err) => err.status === 409,
  );
});

test('updateProductCategory throws 404 if the category does not exist', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();

  await assert.rejects(
    async () => await updateProductCategory(NON_EXISTENT_ID, { name: 'Pizzas' }, categoriesRepo),
    (err) => err.status === 404,
  );
});

test('removeProductCategory disables a product category', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);

  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  const categories = categoriesRepo._getCategories();

  assert.equal(categories.length, 1);
  assert.equal(categories[0].name, 'Pizzas');

  assert.equal(categories[0].isActive, false);
});

test('removeProductCategory throws 404 if category does not exist', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();

  await assert.rejects(
    () => removeProductCategory(NON_EXISTENT_ID, categoriesRepo, productsRepo),
    err => err.status === 404,
  );
});

test('removeProductCategory throws 404 if the category is already inactive', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory(
    { name: 'Pizzas' },
    categoriesRepo,
  );

  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  await assert.rejects(
    () => removeProductCategory(created.id, categoriesRepo, productsRepo),
    (err) => err.status === 404,
  );

  assert.equal(categoriesRepo._getCategories().length, 1);
  assert.equal(categoriesRepo._getCategories()[0].isActive, false);
});

test('removeProductCategory throws 409 if an active product references the category', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await productsRepo.create({ name: 'Margherita', description: 'x', categoryId: created.id });

  await assert.rejects(
    () => removeProductCategory(created.id, categoriesRepo, productsRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo._getCategories()[0].isActive, true);
});

test('removeProductCategory ignores inactive products', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await productsRepo.create({
    name: 'Margherita',
    description: 'x',
    categoryId: created.id,
    isActive: false,
  });

  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  assert.equal(categoriesRepo._getCategories()[0].isActive, false);
});

test('an inactive category is not listed but can still be found and consulted', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await createProductCategory({ name: 'Bebidas' }, categoriesRepo);

  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  const listed = await listProductCategories(undefined, categoriesRepo);
  assert.deepEqual(listed.map((c) => c.name), ['Bebidas']);

  const found = await listProductCategories('pizzas', categoriesRepo);
  assert.equal(found.length, 1);
  assert.equal(found[0].isActive, false);

  const byId = await getProductCategoryById(created.id, categoriesRepo);
  assert.equal(byId.isActive, false);
});

test('updateProductCategory throws 409 if the category is inactive', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  await assert.rejects(
    () => updateProductCategory(created.id, { name: 'Outro' }, categoriesRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo._getCategories()[0].name, 'Pizzas');
});

test('createProductCategory can reuse the name of an inactive category', async () => {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const created = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);
  await removeProductCategory(created.id, categoriesRepo, productsRepo);

  const again = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);

  assert.notEqual(again.id, created.id);
  assert.equal(again.isActive, true);
  assert.equal(categoriesRepo._getCategories().length, 2);
});