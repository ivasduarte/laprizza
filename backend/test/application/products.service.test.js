import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
} from '../../src/application/products/products.service.js';

const CATEGORY_ID = 'abcdef000000000000000001';
const ALLERGEN_ID = 'a11e12000000000000000001';
const TYPE_ID = 'abcdef000000000000000002';
const PRODUCT_ID = 'e0e0e0000000000000000001';
const STOCK_ID = 'f0f0f0000000000000000001';

const byId = (doc) => async (id) => (String(id) === String(doc._id) ? doc : null);

/**
 * Mocked repositories for the products service. Only the known category, allergen and pizza
 * component type exist; `product` is what productsRepository.findById returns.
 */
function setupRepos(product = null) {
  return {
    productsRepository: {
      findById: mock.fn(async (id) => (product && String(id) === String(product._id) ? product : null)),
      findByName: mock.fn(async () => null),
      create: mock.fn(async (data) => ({
        _id: PRODUCT_ID,
        isActive: true,
        pizzaComponentTypeId: null,
        allergenIds: [],
        sizeConfigurations: [],
        ...data,
      })),
      update: mock.fn(async (_id, data) => ({ ...product, ...data })),
      listProducts: mock.fn(async () => []),
    },
    categoriesRepository: {
      findById: mock.fn(byId({ _id: CATEGORY_ID, name: 'Bebidas', isActive: true })),
    },
    allergensRepository: {
      findById: mock.fn(byId({ _id: ALLERGEN_ID, name: 'Glúten', isActive: true })),
    },
    pizzaComponentTypesRepository: {
      findById: mock.fn(byId({ _id: TYPE_ID, name: 'Dough', isActive: true })),
    },
    stockRepository: {
      create: mock.fn(async (data) => ({ _id: STOCK_ID, ...data })),
    },
  };
}

const VALID_PRODUCT_DATA = {
  name: 'Coca-Cola',
  description: 'Refrigerante',
  price: 1.5,
  sellable: true,
  stockControlled: true,
};

/** Stored product document, as returned by the repository. */
const storedProduct = (data = {}) => ({
  _id: PRODUCT_ID,
  ...VALID_PRODUCT_DATA,
  categoryId: CATEGORY_ID,
  pizzaComponentTypeId: null,
  allergenIds: [],
  sizeConfigurations: [],
  isActive: true,
  ...data,
});

test('createProduct enforces price rule for sellable products', async () => {
  const repos = setupRepos();

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, price: undefined, categoryId: CATEGORY_ID },
        repos,
      ),
    (err) => err instanceof AppError && err.status === 400,
  );

  await assert.rejects(
    async () => await createProduct({ ...VALID_PRODUCT_DATA, price: -1, categoryId: CATEGORY_ID }, repos),
    (err) => err.status === 400,
  );
  assert.equal(repos.productsRepository.create.mock.callCount(), 0);
});

test('createProduct validates references', async () => {
  const repos = setupRepos();

  await assert.rejects(
    async () => await createProduct({ ...VALID_PRODUCT_DATA, categoryId: 'invalid' }, repos),
    (err) => err.status === 404 && err.message.includes('Product Category'),
  );

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, categoryId: CATEGORY_ID, allergenIds: ['invalid'] },
        repos,
      ),
    (err) => err.status === 404 && err.message.includes('Allergen'),
  );

  await assert.rejects(
    async () =>
      await createProduct(
        {
          ...VALID_PRODUCT_DATA,
          categoryId: CATEGORY_ID,
          pizzaComponentTypeId: 'invalid',
        },
        repos,
      ),
    (err) => err.status === 404 && err.message.includes('Pizza Component Type'),
  );
  assert.equal(repos.productsRepository.create.mock.callCount(), 0);
});

test('createProduct rejects duplicate names with 409 Conflict', async () => {
  const repos = setupRepos();
  repos.productsRepository.findByName.mock.mockImplementation(async () =>
    storedProduct({ name: 'Pizza Exclusiva' }),
  );

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, name: 'Pizza Exclusiva', categoryId: CATEGORY_ID },
        repos,
      ),
    (err) => err.status === 409,
  );
  assert.equal(repos.productsRepository.findByName.mock.calls[0].arguments[0], 'Pizza Exclusiva');
  assert.equal(repos.productsRepository.create.mock.callCount(), 0);
});

test('createProduct creates a product successfully and exposes DTO', async () => {
  const repos = setupRepos();

  const created = await createProduct(
    {
      ...VALID_PRODUCT_DATA,
      categoryId: CATEGORY_ID,
      pizzaComponentTypeId: TYPE_ID,
      allergenIds: [ALLERGEN_ID],
    },
    repos,
  );

  assert.ok(created.id);
  assert.equal(created._id, undefined);
  assert.equal(created.isPizzaComponent, true);
  assert.equal(created.name, 'Coca-Cola');
  assert.deepEqual(created.allergenIds, [ALLERGEN_ID]);
  // Stock-controlled products get a stock entry at 0.
  assert.deepEqual(repos.stockRepository.create.mock.calls[0].arguments[0], {
    productId: PRODUCT_ID,
    quantity: 0,
  });
});

test('updateProduct updates references and recalculates isPizzaComponent', async () => {
  const repos = setupRepos(
    storedProduct({ pizzaComponentTypeId: TYPE_ID, allergenIds: [ALLERGEN_ID] }),
  );

  const updated = await updateProduct(
    PRODUCT_ID,
    { pizzaComponentTypeId: null, allergenIds: [] },
    repos,
  );

  assert.equal(updated.isPizzaComponent, false);
  assert.equal(updated.pizzaComponentTypeId, null);
  assert.deepEqual(updated.allergenIds, []);
  assert.deepEqual(repos.productsRepository.update.mock.calls[0].arguments, [
    PRODUCT_ID,
    { pizzaComponentTypeId: null, allergenIds: [] },
  ]);
});

test('updateProduct applies partial changes and checks business rules', async () => {
  const repos = setupRepos(storedProduct());

  await updateProduct(PRODUCT_ID, { sellable: false }, repos);
  assert.deepEqual(repos.productsRepository.update.mock.calls[0].arguments[1], { sellable: false });

  await assert.rejects(
    async () => await updateProduct(PRODUCT_ID, { sellable: true, price: -5 }, repos),
    (err) => err.status === 400,
  );
  assert.equal(repos.productsRepository.update.mock.callCount(), 1);

  const updated = await updateProduct(PRODUCT_ID, { isActive: false, name: 'Nova Cola' }, repos);
  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'Nova Cola');
});

test('getProductById returns the product DTO or throws 404', async () => {
  const repos = setupRepos(storedProduct());

  const found = await getProductById(PRODUCT_ID, repos);
  assert.equal(found.id, PRODUCT_ID);
  assert.equal(found.name, 'Coca-Cola');

  await assert.rejects(
    async () => await getProductById('id_inexistente', repos),
    (err) => err.status === 404 && err.message.includes('Product not found'),
  );
});

test('listProducts returns products and applies filters correctly', async () => {
  const productA = storedProduct({ name: 'Produto A' });
  const productB = storedProduct({ _id: 'e0e0e0000000000000000002', name: 'Produto B', isActive: false });
  const repos = setupRepos();
  const { listProducts: listMock } = repos.productsRepository;

  listMock.mock.mockImplementationOnce(async () => [productA, productB], 0);
  listMock.mock.mockImplementationOnce(async () => [productA], 1);
  listMock.mock.mockImplementationOnce(async () => [productA], 2);
  listMock.mock.mockImplementationOnce(async () => [productB], 3);

  const all = await listProducts({}, repos);
  assert.equal(all.length, 2);

  const searchResult = await listProducts({ search: 'Produto A' }, repos);
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].name, 'Produto A');

  const activeOnly = await listProducts({ isActive: true }, repos);
  assert.equal(activeOnly.length, 1);
  assert.equal(activeOnly[0].name, 'Produto A');

  const inactiveOnly = await listProducts({ isActive: false }, repos);
  assert.equal(inactiveOnly.length, 1);
  assert.equal(inactiveOnly[0].name, 'Produto B');

  // The filters are delegated to the repository untouched.
  assert.deepEqual(
    listMock.mock.calls.map((c) => c.arguments[0]),
    [{}, { search: 'Produto A' }, { isActive: true }, { isActive: false }],
  );
});

// Pizza size the size configurations of the tests refer to (the products service does not validate it)
const SIZE_ID = 'abcdef000000000000000050';
const SIZE_CONFIGURATION = { pizzaSizeId: SIZE_ID, price: 1, stockUnitsConsumed: 2 };

const pizzaComponent = (data = {}) =>
  storedProduct({ name: 'Mozzarella', pizzaComponentTypeId: TYPE_ID, ...data });

test('updateProduct refuses to deactivate a product with size configurations', async () => {
  const repos = setupRepos(pizzaComponent({ sizeConfigurations: [SIZE_CONFIGURATION] }));

  await assert.rejects(
    async () => await updateProduct(PRODUCT_ID, { isActive: false }, repos),
    (err) => err.status === 409 && /size configurations/i.test(err.message),
  );

  // The product is never updated, so it stays active and keeps its configuration
  assert.equal(repos.productsRepository.update.mock.callCount(), 0);
});

test('updateProduct deactivates a product once its size configurations are removed', async () => {
  const repos = setupRepos(pizzaComponent({ sizeConfigurations: [] }));

  const updated = await updateProduct(PRODUCT_ID, { isActive: false }, repos);

  assert.equal(updated.isActive, false);
});

test('updateProduct deactivates a pizza component that has no size configurations', async () => {
  const repos = setupRepos(pizzaComponent({ sizeConfigurations: undefined }));

  const updated = await updateProduct(PRODUCT_ID, { isActive: false }, repos);

  assert.equal(updated.isActive, false);
  assert.deepEqual(repos.productsRepository.update.mock.calls[0].arguments[1], { isActive: false });
});

test('updateProduct still allows other changes to a product with size configurations', async () => {
  const repos = setupRepos(pizzaComponent({ sizeConfigurations: [SIZE_CONFIGURATION] }));

  const updated = await updateProduct(
    PRODUCT_ID,
    { name: 'Mozzarella Extra', price: 2, isActive: true },
    repos,
  );

  assert.equal(updated.name, 'Mozzarella Extra');
  assert.equal(updated.isActive, true);
  // The configurations are not part of the patch.
  assert.equal(repos.productsRepository.update.mock.calls[0].arguments[1].sizeConfigurations, undefined);
});
