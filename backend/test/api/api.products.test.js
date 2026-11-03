import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createDummyUsersRepository } from '../infrastructure/users.dummy.repository.js';
import { createDummyAuthInfrastructure } from '../infrastructure/auth.dummy.dependencies.js';
import { createDummyProductsRepository } from '../infrastructure/products.dummy.repository.js';
import { createDummyProductCategoriesRepository } from '../infrastructure/product-categories.dummy.repository.js';
import { createDummyAllergenRepository } from '../infrastructure/allergens.dummy.repository.js';
import { createDummyPizzaComponentTypesRepository } from '../infrastructure/pizza-component-type.dummy.repository.js';
import { createDummyStockRepository } from '../infrastructure/stock.dummy.repository.js';
import { createDummyPizzaSizeRepository } from '../infrastructure/pizza-size.dummy.repository.js';
import { createSize } from '../../src/application/pizza-size/pizza-size.service.js';
import { registerUser } from '../../src/application/auth/auth.service.js';

process.env.JWT_SECRET = 'test_secret_key';

const NON_EXISTENT_ID = 'abcdef000000000000000999';

async function setupTestServer() {
  const usersRepo = createDummyUsersRepository();
  const categoriesRepo = createDummyProductCategoriesRepository();
  const productsRepo = createDummyProductsRepository();
  const allergensRepo = createDummyAllergenRepository();
  const typesRepo = createDummyPizzaComponentTypesRepository();
  const stockRepo = createDummyStockRepository();
  const sizeRepo = createDummyPizzaSizeRepository();

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createDummyAuthInfrastructure(),
    usersRepository: usersRepo,
    productsRepository: productsRepo,
    allergensRepository: allergensRepo,
    categoriesRepository: categoriesRepo,
    productCategoriesRepository: categoriesRepo,
    pizzaComponentTypesRepository: typesRepo,
    pizzaComponentTypeRepository: typesRepo,
    stockRepository: stockRepo,
    sizeRepository: sizeRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  await registerUser(
    { email: 'admin@laprizza.pt', password: 'StrongPassword123!', role: 'MANAGER' },
    usersRepo,
  );
  await registerUser(
    { email: 'emp@laprizza.pt', password: 'StrongPassword123!', role: 'EMPLOYEE' },
    usersRepo,
  );

  const cat = await categoriesRepo.create({ name: 'Bebidas' });

  return { server, port, categoriesRepo, typesRepo, sizeRepo, catId: String(cat._id) };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  return (await res.json()).accessToken;
}

function request(port, method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('API /products RBAC: 401 Sem Token e 403 Funcionário a tentar Criar/Editar', async (t) => {
  const { server, port } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empToken = await loginAs(port, 'emp@laprizza.pt');

  assert.equal((await request(port, 'GET', '/products')).status, 401);
  assert.equal((await request(port, 'POST', '/products')).status, 401);

  assert.equal(
    (await request(port, 'POST', '/products', { token: empToken, body: {} })).status,
    403,
  );
  assert.equal(
    (await request(port, 'PATCH', `/products/${NON_EXISTENT_ID}`, { token: empToken, body: {} }))
      .status,
    403,
  );

  assert.equal((await request(port, 'GET', '/products', { token: empToken })).status, 200);
});

test('API POST /products Joi e Respostas', async (t) => {
  const { server, port, catId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const validPayload = {
    name: 'Água',
    description: 'Água lisa',
    price: 1,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  assert.equal(
    (
      await request(port, 'POST', '/products', {
        token: adminToken,
        body: { name: 'X', description: 'Y', stockControlled: true, categoryId: catId },
      })
    ).status,
    400,
  );

  assert.equal(
    (
      await request(port, 'POST', '/products', {
        token: adminToken,
        body: { ...validPayload, categoryId: 'abc' },
      })
    ).status,
    400,
  );

  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: validPayload,
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.equal(createdBody.name, 'Água');
});

test('API POST /products returns 409 for duplicate product name', async (t) => {
  const { server, port, catId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const payload = {
    name: 'Sumo Laranja',
    description: 'Sumo natural',
    price: 2.5,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  const res1 = await request(port, 'POST', '/products', { token: adminToken, body: payload });
  assert.equal(res1.status, 201);

  const res2 = await request(port, 'POST', '/products', { token: adminToken, body: payload });
  assert.equal(res2.status, 409);
});

test('API POST /products Joi validates allergens and pizza component types', async (t) => {
  const { server, port, catId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');
  const validPayload = {
    name: 'Pizza',
    description: 'Teste',
    price: 1,
    sellable: true,
    stockControlled: true,
    categoryId: catId,
  };

  const resDup = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      ...validPayload,
      allergenIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'],
    },
  });
  assert.equal(resDup.status, 400);

  const resFormat = await request(port, 'POST', '/products', {
    token: adminToken,
    body: { ...validPayload, pizzaComponentTypeId: 'formato_invalido_123' },
  });
  assert.equal(resFormat.status, 400);
});

test('API GET e PATCH /products/:id Atualizações Parciais', async (t) => {
  const { server, port, catId } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      name: 'Pizza',
      description: 'Teste',
      price: 10,
      sellable: true,
      stockControlled: true,
      categoryId: catId,
    },
  });
  const id = (await createRes.json()).id;

  const patchRes = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(patchRes.status, 200);
  assert.equal((await patchRes.json()).isActive, false);

  assert.equal(
    (await request(port, 'PATCH', `/products/${id}`, { token: adminToken, body: {} })).status,
    400,
  );

  assert.equal(
    (await request(port, 'GET', `/products/${NON_EXISTENT_ID}`, { token: adminToken })).status,
    404,
  );
});

test('API PATCH /products/:id refuses to deactivate a product with size configurations', async (t) => {
  const { server, port, catId, typesRepo, sizeRepo } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const adminToken = await loginAs(port, 'admin@laprizza.pt');

  // A pizza component with a size configuration
  const type = await typesRepo.create({
    name: 'Cheese',
    assemblyOrder: 3,
    minQuantity: 0,
    maxQuantity: 1,
  });
  const createRes = await request(port, 'POST', '/products', {
    token: adminToken,
    body: {
      name: 'Mozzarella',
      description: 'Cheese',
      sellable: false,
      stockControlled: true,
      categoryId: catId,
      pizzaComponentTypeId: String(type._id),
    },
  });
  assert.equal(createRes.status, 201);
  const id = (await createRes.json()).id;

  const size = await createSize({ name: 'Small' }, sizeRepo);
  const configRes = await request(port, 'POST', `/products/${id}/size-configurations`, {
    token: adminToken,
    body: { pizzaSizeId: size.id, price: 1.5, stockUnitsConsumed: 2 },
  });
  assert.equal(configRes.status, 201);

  // 409 Conflict - the product has size configurations and cannot be removed
  const blocked = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(blocked.status, 409);

  // The product is still active
  const found = await request(port, 'GET', `/products/${id}`, { token: adminToken });
  assert.equal((await found.json()).isActive, true);

  // Other changes are still allowed
  const renamed = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { name: 'Mozzarella Extra' },
  });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).name, 'Mozzarella Extra');

  // 200 OK - once the configuration is removed the product can be deactivated
  const removed = await request(port, 'DELETE', `/products/${id}/size-configurations/${size.id}`, {
    token: adminToken,
  });
  assert.equal(removed.status, 200);

  const deactivated = await request(port, 'PATCH', `/products/${id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivated.status, 200);
  assert.equal((await deactivated.json()).isActive, false);
});