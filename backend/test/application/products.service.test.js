import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/AppError.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyProductCategoriesRepository } from '../infrastructure/product-categories.dummy.repository.js';
import { createDummyAllergenRepository } from '../infrastructure/allergens.dummy.repository.js';
import { createDummyPizzaComponentTypesRepository } from '../infrastructure/pizza-component-type.dummy.repository.js';
import { createDummyStockRepository } from '../infrastructure/stock.dummy.repository.js';
import {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
} from '../../src/application/products.service.js';

async function setupRepos() {
  const categoriesRepo = createDummyProductCategoriesRepository();
  const cat = await categoriesRepo.create({ name: 'Bebidas' });

  const allergensRepo = createDummyAllergenRepository();
  const allergen = await allergensRepo.create({ name: 'Glúten' });

  const typeRepo = createDummyPizzaComponentTypesRepository();
  const type = await typeRepo.create({
    name: 'Dough',
    assemblyOrder: 1,
    minQuantity: 1,
    maxQuantity: 1,
  });

  const stockRepo = createDummyStockRepository();

  return {
    productsRepository: createDummyProductsRepository(),
    categoriesRepository: categoriesRepo,
    allergensRepository: allergensRepo,
    pizzaComponentTypesRepository: typeRepo,
    stockRepository: stockRepo,
    validCategory: cat,
    validAllergen: allergen,
    validType: type,
  };
}

const VALID_PRODUCT_DATA = {
  name: 'Coca-Cola',
  description: 'Refrigerante',
  price: 1.5,
  sellable: true,
  stockControlled: true,
};

test('createProduct enforces price rule for sellable products', async () => {
  const repos = await setupRepos();

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, price: undefined, categoryId: repos.validCategory._id },
        repos,
      ),
    (err) => err instanceof AppError && err.status === 400,
  );

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, price: -1, categoryId: repos.validCategory._id },
        repos,
      ),
    (err) => err.status === 400,
  );
});

test('createProduct validates references', async () => {
  const repos = await setupRepos();

  await assert.rejects(
    async () => await createProduct({ ...VALID_PRODUCT_DATA, categoryId: 'invalid' }, repos),
    (err) => err.status === 404 && err.message.includes('Product Category'),
  );

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, categoryId: repos.validCategory._id, allergenIds: ['invalid'] },
        repos,
      ),
    (err) => err.status === 404 && err.message.includes('Allergen'),
  );

  await assert.rejects(
    async () =>
      await createProduct(
        {
          ...VALID_PRODUCT_DATA,
          categoryId: repos.validCategory._id,
          pizzaComponentTypeId: 'invalid',
        },
        repos,
      ),
    (err) => err.status === 404 && err.message.includes('Pizza Component Type'),
  );
});

test('createProduct rejects duplicate names with 409 Conflict', async () => {
  const repos = await setupRepos();

  await createProduct(
    { ...VALID_PRODUCT_DATA, name: 'Pizza Exclusiva', categoryId: repos.validCategory._id },
    repos,
  );

  await assert.rejects(
    async () =>
      await createProduct(
        { ...VALID_PRODUCT_DATA, name: 'Pizza Exclusiva', categoryId: repos.validCategory._id },
        repos,
      ),
    (err) => err.status === 409,
  );
});

test('createProduct creates a product successfully and exposes DTO', async () => {
  const repos = await setupRepos();

  const created = await createProduct(
    {
      ...VALID_PRODUCT_DATA,
      categoryId: repos.validCategory._id,
      pizzaComponentTypeId: repos.validType._id,
      allergenIds: [repos.validAllergen._id],
    },
    repos,
  );

  assert.ok(created.id);
  assert.equal(created._id, undefined);
  assert.equal(created.isPizzaComponent, true);
  assert.equal(created.name, 'Coca-Cola');
  assert.deepEqual(created.allergenIds, [repos.validAllergen._id]);
});

test('updateProduct updates references and recalculates isPizzaComponent', async () => {
  const repos = await setupRepos();
  const product = await createProduct(
    {
      ...VALID_PRODUCT_DATA,
      categoryId: repos.validCategory._id,
      pizzaComponentTypeId: repos.validType._id,
      allergenIds: [repos.validAllergen._id],
    },
    repos,
  );

  assert.equal(product.isPizzaComponent, true);

  const updated = await updateProduct(
    product.id,
    { pizzaComponentTypeId: null, allergenIds: [] },
    repos,
  );

  assert.equal(updated.isPizzaComponent, false);
  assert.equal(updated.pizzaComponentTypeId, null);
  assert.deepEqual(updated.allergenIds, []);
});

test('updateProduct applies partial changes and checks business rules', async () => {
  const repos = await setupRepos();
  const product = await createProduct(
    { ...VALID_PRODUCT_DATA, categoryId: repos.validCategory._id },
    repos,
  );

  await updateProduct(product.id, { sellable: false }, repos);
  await assert.rejects(
    async () => await updateProduct(product.id, { sellable: true, price: -5 }, repos),
    (err) => err.status === 400,
  );

  const updated = await updateProduct(product.id, { isActive: false, name: 'Nova Cola' }, repos);
  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'Nova Cola');
});

test('getProductById returns the product DTO or throws 404', async () => {
  const repos = await setupRepos();
  const created = await createProduct(
    { ...VALID_PRODUCT_DATA, categoryId: repos.validCategory._id },
    repos,
  );

  const found = await getProductById(created.id, repos);
  assert.equal(found.id, created.id);
  assert.equal(found.name, 'Coca-Cola');

  await assert.rejects(
    async () => await getProductById('id_inexistente', repos),
    (err) => err.status === 404 && err.message.includes('Product not found'),
  );
});

test('listProducts returns products and applies filters correctly', async () => {
  const repos = await setupRepos();

  await createProduct(
    { ...VALID_PRODUCT_DATA, name: 'Produto A', categoryId: repos.validCategory._id },
    repos,
  );
  const p2 = await createProduct(
    { ...VALID_PRODUCT_DATA, name: 'Produto B', categoryId: repos.validCategory._id },
    repos,
  );

  await updateProduct(p2.id, { isActive: false }, repos);

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
});

// Pizza size the size configurations of the tests refer to (the products service does not validate it)
const SIZE_ID = 'abcdef000000000000000050';

async function createPizzaComponent(repos, name = 'Mozzarella') {
  return createProduct(
    {
      ...VALID_PRODUCT_DATA,
      name,
      categoryId: repos.validCategory._id,
      pizzaComponentTypeId: repos.validType._id,
    },
    repos,
  );
}

async function addSizeConfiguration(repos, productId) {
  await repos.productsRepository.addSizeConfiguration(productId, {
    pizzaSizeId: SIZE_ID,
    price: 1,
    stockUnitsConsumed: 2,
  });
}

test('updateProduct refuses to deactivate a product with size configurations', async () => {
  const repos = await setupRepos();
  const product = await createPizzaComponent(repos);
  await addSizeConfiguration(repos, product.id);

  await assert.rejects(
    async () => await updateProduct(product.id, { isActive: false }, repos),
    (err) => err.status === 409 && /size configurations/i.test(err.message),
  );

  // The product is still active and keeps its configuration
  assert.equal((await getProductById(product.id, repos)).isActive, true);
  assert.equal((await repos.productsRepository.findById(product.id)).sizeConfigurations.length, 1);
});

test('updateProduct deactivates a product once its size configurations are removed', async () => {
  const repos = await setupRepos();
  const product = await createPizzaComponent(repos);
  await addSizeConfiguration(repos, product.id);
  await repos.productsRepository.removeSizeConfiguration(product.id, SIZE_ID);

  const updated = await updateProduct(product.id, { isActive: false }, repos);

  assert.equal(updated.isActive, false);
});

test('updateProduct deactivates a pizza component that has no size configurations', async () => {
  const repos = await setupRepos();
  const product = await createPizzaComponent(repos);

  const updated = await updateProduct(product.id, { isActive: false }, repos);

  assert.equal(updated.isActive, false);
});

test('updateProduct still allows other changes to a product with size configurations', async () => {
  const repos = await setupRepos();
  const product = await createPizzaComponent(repos);
  await addSizeConfiguration(repos, product.id);

  const updated = await updateProduct(
    product.id,
    { name: 'Mozzarella Extra', price: 2, isActive: true },
    repos,
  );

  assert.equal(updated.name, 'Mozzarella Extra');
  assert.equal(updated.isActive, true);
  assert.equal((await repos.productsRepository.findById(product.id)).sizeConfigurations.length, 1);
});