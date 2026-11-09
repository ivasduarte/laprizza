import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  listProductCategories,
  createProductCategory,
  getProductCategoryById,
  updateProductCategory,
  removeProductCategory,
} from '../../src/application/product-categories/product-categories.service.js';

// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';
const CATEGORY_ID = 'abcdef000000000000000001';
const OTHER_CATEGORY_ID = 'abcdef000000000000000002';

const duplicateKeyError = () => Object.assign(new Error('Duplicate Key'), { code: 11000 });

/** Categories repository whose findById knows only `category` and whose update merges the patch. */
const createCategoriesRepository = (category) => ({
  findById: mock.fn(async (id) => (category && String(id) === String(category._id) ? category : null)),
  update: mock.fn(async (_id, data) => ({ ...category, ...data })),
});

const createProductsRepository = (isReferenced = false) => ({
  existsByCategory: mock.fn(async () => isReferenced),
});

test('createProductCategory saves a normalized name and returns a DTO', async () => {
  const categoriesRepo = {
    create: mock.fn(async (data) => ({ _id: CATEGORY_ID, ...data, isActive: true })),
  };

  const created = await createProductCategory({ name: '  Soft   Drinks' }, categoriesRepo);

  assert.equal(categoriesRepo.create.mock.callCount(), 1);
  assert.deepEqual(categoriesRepo.create.mock.calls[0].arguments[0], { name: 'Soft Drinks' });
  assert.ok(created.id);
  assert.equal(created.name, 'Soft Drinks');
  assert.equal(created._id, undefined);
});

test('createProductCategory rejects blank or missing names without saving', async () => {
  const categoriesRepo = { create: mock.fn() };

  await assert.rejects(
    async () => await createProductCategory({ name: '   ' }, categoriesRepo),
    (err) => err.status === 400,
  );
  await assert.rejects(
    async () => await createProductCategory({}, categoriesRepo),
    (err) => err.status === 400,
  );

  assert.equal(categoriesRepo.create.mock.callCount(), 0);
});

test('createProductCategory returns 409 Conflict on duplicate name', async () => {
  const categoriesRepo = {
    create: mock.fn(async () => {
      throw duplicateKeyError();
    }),
  };

  await assert.rejects(
    async () => await createProductCategory({ name: 'CAFE' }, categoriesRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo.create.mock.callCount(), 1);
});

test('listProductCategories without a name returns all categories', async () => {
  const categoriesRepo = {
    listProductCategories: mock.fn(async () => [
      { _id: CATEGORY_ID, name: 'Pizzas', isActive: true },
      { _id: OTHER_CATEGORY_ID, name: 'Bebidas', isActive: true },
    ]),
    searchByName: mock.fn(),
  };

  const categories = await listProductCategories(undefined, categoriesRepo);

  assert.ok(Array.isArray(categories));
  assert.equal(categories.length, 2);
  assert.ok(categories[0].id);
  assert.equal(categories[0]._id, undefined);
  assert.equal(categoriesRepo.searchByName.mock.callCount(), 0);
});

test('listProductCategories finds the exact name ignoring case and accents', async () => {
  const categoriesRepo = {
    listProductCategories: mock.fn(),
    searchByName: mock.fn(async () => [{ _id: CATEGORY_ID, name: 'Café', isActive: true }]),
  };

  const found = await listProductCategories('cafe', categoriesRepo);

  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Café');
  assert.equal(categoriesRepo.searchByName.mock.calls[0].arguments[0], 'cafe');
  assert.equal(categoriesRepo.listProductCategories.mock.callCount(), 0);
});

test('listProductCategories returns an empty list for partial or blank names', async () => {
  const categoriesRepo = { searchByName: mock.fn(async () => []) };

  assert.deepEqual(await listProductCategories('bever', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('Beb', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('', categoriesRepo), []);
  assert.deepEqual(await listProductCategories('   ', categoriesRepo), []);
  assert.deepEqual(
    categoriesRepo.searchByName.mock.calls.map((c) => c.arguments[0]),
    ['bever', 'Beb', '', '   '],
  );
});

test('getProductCategoryById returns the category or throws 404', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: true,
  });

  const found = await getProductCategoryById(CATEGORY_ID, categoriesRepo);
  assert.equal(found.name, 'Pizzas');

  await assert.rejects(
    async () => await getProductCategoryById(NON_EXISTENT_ID, categoriesRepo),
    (err) => err.status === 404,
  );
});

test('updateProductCategory changes the name', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Bebidas',
    isActive: true,
  });

  const updated = await updateProductCategory(
    CATEGORY_ID,
    { name: '  Soft   Drinks ' },
    categoriesRepo,
  );

  assert.equal(updated.id, CATEGORY_ID);
  assert.equal(updated.name, 'Soft Drinks');
  assert.deepEqual(categoriesRepo.update.mock.calls[0].arguments, [
    CATEGORY_ID,
    { name: 'Soft Drinks' },
  ]);
});

test('updateProductCategory allows changing only the case of its own name', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Bebidas',
    isActive: true,
  });

  const updated = await updateProductCategory(CATEGORY_ID, { name: 'bebidas' }, categoriesRepo);

  assert.equal(updated.name, 'bebidas');
});

test('updateProductCategory rejects blank names', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Bebidas',
    isActive: true,
  });

  await assert.rejects(
    async () => await updateProductCategory(CATEGORY_ID, { name: '  ' }, categoriesRepo),
    (err) => err.status === 400,
  );

  assert.equal(categoriesRepo.update.mock.callCount(), 0);
});

test('updateProductCategory returns 409 Conflict on duplicate name', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: OTHER_CATEGORY_ID,
    name: 'Bebidas',
    isActive: true,
  });
  categoriesRepo.update.mock.mockImplementation(async () => {
    throw duplicateKeyError();
  });

  await assert.rejects(
    async () => await updateProductCategory(OTHER_CATEGORY_ID, { name: 'PIZZAS' }, categoriesRepo),
    (err) => err.status === 409,
  );
});

test('updateProductCategory throws 404 if the category does not exist', async () => {
  const categoriesRepo = createCategoriesRepository(null);

  await assert.rejects(
    async () => await updateProductCategory(NON_EXISTENT_ID, { name: 'Pizzas' }, categoriesRepo),
    (err) => err.status === 404,
  );
  assert.equal(categoriesRepo.update.mock.callCount(), 0);
});

test('removeProductCategory disables a product category', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: true,
  });
  const productsRepo = createProductsRepository(false);

  await removeProductCategory(CATEGORY_ID, categoriesRepo, productsRepo);

  assert.equal(productsRepo.existsByCategory.mock.calls[0].arguments[0], CATEGORY_ID);
  assert.deepEqual(categoriesRepo.update.mock.calls[0].arguments, [
    CATEGORY_ID,
    { isActive: false },
  ]);
});

test('removeProductCategory throws 404 if category does not exist', async () => {
  const categoriesRepo = createCategoriesRepository(null);
  const productsRepo = createProductsRepository(false);

  await assert.rejects(
    () => removeProductCategory(NON_EXISTENT_ID, categoriesRepo, productsRepo),
    (err) => err.status === 404,
  );
  assert.equal(productsRepo.existsByCategory.mock.callCount(), 0);
});

test('removeProductCategory throws 404 if the category is already inactive', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: false,
  });
  const productsRepo = createProductsRepository(false);

  await assert.rejects(
    () => removeProductCategory(CATEGORY_ID, categoriesRepo, productsRepo),
    (err) => err.status === 404,
  );

  assert.equal(categoriesRepo.update.mock.callCount(), 0);
});

test('removeProductCategory throws 409 if an active product references the category', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: true,
  });
  const productsRepo = createProductsRepository(true);

  await assert.rejects(
    () => removeProductCategory(CATEGORY_ID, categoriesRepo, productsRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo.update.mock.callCount(), 0);
});

test('removeProductCategory ignores inactive products', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: true,
  });
  // existsByCategory only counts active products, so an inactive one yields false.
  const productsRepo = createProductsRepository(false);

  await removeProductCategory(CATEGORY_ID, categoriesRepo, productsRepo);

  assert.deepEqual(categoriesRepo.update.mock.calls[0].arguments[1], { isActive: false });
});

test('an inactive category is not listed but can still be found and consulted', async () => {
  const inactive = { _id: CATEGORY_ID, name: 'Pizzas', isActive: false };
  const categoriesRepo = {
    ...createCategoriesRepository(inactive),
    listProductCategories: mock.fn(async () => [
      { _id: OTHER_CATEGORY_ID, name: 'Bebidas', isActive: true },
    ]),
    searchByName: mock.fn(async () => [inactive]),
  };

  const listed = await listProductCategories(undefined, categoriesRepo);
  assert.deepEqual(
    listed.map((c) => c.name),
    ['Bebidas'],
  );

  const found = await listProductCategories('pizzas', categoriesRepo);
  assert.equal(found.length, 1);
  assert.equal(found[0].isActive, false);

  const byId = await getProductCategoryById(CATEGORY_ID, categoriesRepo);
  assert.equal(byId.isActive, false);
});

test('updateProductCategory throws 409 if the category is inactive', async () => {
  const categoriesRepo = createCategoriesRepository({
    _id: CATEGORY_ID,
    name: 'Pizzas',
    isActive: false,
  });

  await assert.rejects(
    () => updateProductCategory(CATEGORY_ID, { name: 'Outro' }, categoriesRepo),
    (err) => err.status === 409,
  );

  assert.equal(categoriesRepo.update.mock.callCount(), 0);
});

test('createProductCategory can reuse the name of an inactive category', async () => {
  // The unique index only covers active categories, so create succeeds with a new id.
  const categoriesRepo = {
    create: mock.fn(async (data) => ({ _id: OTHER_CATEGORY_ID, ...data, isActive: true })),
  };

  const again = await createProductCategory({ name: 'Pizzas' }, categoriesRepo);

  assert.notEqual(again.id, CATEGORY_ID);
  assert.equal(again.isActive, true);
  assert.equal(categoriesRepo.create.mock.callCount(), 1);
});
