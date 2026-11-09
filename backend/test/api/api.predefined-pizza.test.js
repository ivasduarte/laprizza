import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
// Same hasher the API uses by default to verify passwords at login.
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const USERS = [
  { _id: 'abcdef000000000000000001', email: 'admin@laprizza.pt', role: 'MANAGER' },
  { _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', role: 'EMPLOYEE' },
].map((user) => ({
  ...user,
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
}));

/** Mocked users repository and auth infrastructure: just enough to log in through the API. */
function createAuthMocks() {
  const userById = (id) => USERS.find((u) => u._id === String(id)) ?? null;
  return {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(async (email) => USERS.find((u) => u.email === email) ?? null),
      findById: mock.fn(async (id) => userById(id)),
    },
    // One always-active session per user (session id = user id).
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(async (id) =>
        userById(id)
          ? { _id: id, userId: id, tokenVersion: 0, expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null }
          : null,
      ),
    },
    securityLogger: { log: mock.fn() },
  };
}

const hexId = (prefix, n) => prefix + n.toString(16).padStart(24 - prefix.length, '0');

const I = {
  pizzaProduct: hexId('b10a', 1),
  pizzaProduct2: hexId('b10a', 2),
  dough: hexId('b10a', 3),
  doughExtra: hexId('b10a', 4),
  sauce: hexId('b10a', 5),
  cheese: hexId('b10a', 6),
  cheeseExtra: hexId('b10a', 7),
  topping: hexId('b10a', 8),
  toppingExtra: hexId('b10a', 9),
  inactiveTopping: hexId('b10a', 10),
  toppingNoLarge: hexId('b10a', 11),
  sizeSmall: hexId('b105', 1),
  sizeLarge: hexId('b105', 2),
  sizeInactive: hexId('b105', 3),
  typeDough: hexId('b107', 1),
  typeSauce: hexId('b107', 2),
  typeCheese: hexId('b107', 3),
  typeTopping: hexId('b107', 4),
  unknown: hexId('b1ff', 1),
  margheritaPizza: hexId('b10b', 1),
  pepperoniPizza: hexId('b10b', 2),
};

const bothSizes = [I.sizeSmall, I.sizeLarge];

const product = (id, name, extra = {}) => ({
  id,
  name,
  isActive: true,
  sellable: false,
  componentTypeId: null,
  configuredSizeIds: [],
  ...extra,
});

const component = (id, name, componentTypeId, configuredSizeIds = bothSizes, extra = {}) =>
  product(id, name, { componentTypeId, configuredSizeIds, ...extra });

/** Catalogue data returned by the lookup methods of the mocked repository. */
const PRODUCTS = [
  product(I.pizzaProduct, 'Margherita', { sellable: true }),
  product(I.pizzaProduct2, 'Pepperoni', { sellable: true }),
  component(I.dough, 'Classic Dough', I.typeDough),
  component(I.doughExtra, 'Whole Wheat Dough', I.typeDough),
  component(I.sauce, 'Tomato Sauce', I.typeSauce),
  component(I.cheese, 'Mozzarella', I.typeCheese),
  component(I.cheeseExtra, 'Cheddar', I.typeCheese),
  component(I.topping, 'Mushrooms', I.typeTopping),
  component(I.toppingExtra, 'Olives', I.typeTopping),
  component(I.inactiveTopping, 'Old Topping', I.typeTopping, bothSizes, { isActive: false }),
  component(I.toppingNoLarge, 'Anchovies', I.typeTopping, [I.sizeSmall]),
];

const SIZES = [
  { id: I.sizeSmall, name: 'Small', isActive: true },
  { id: I.sizeLarge, name: 'Large', isActive: true },
  { id: I.sizeInactive, name: 'Family', isActive: false },
];

const COMPONENT_TYPES = [
  { id: I.typeDough, name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
  { id: I.typeSauce, name: 'Base Sauce', assemblyOrder: 2, minQuantity: 0, maxQuantity: 1 },
  { id: I.typeCheese, name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 },
  { id: I.typeTopping, name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null },
];

const idsIn = (ids) => (item) => ids.map(String).includes(item.id);

async function setupTestServer() {
  // Lookups resolve against the catalogue data; no predefined pizza exists until a test stores one.
  const pizzaRepo = {
    findProductById: mock.fn(async (id) => PRODUCTS.find((p) => p.id === String(id)) ?? null),
    findProductsByIds: mock.fn(async (ids) => PRODUCTS.filter(idsIn(ids))),
    findSizesByIds: mock.fn(async (ids) => SIZES.filter(idsIn(ids))),
    listComponentTypes: mock.fn(async () => COMPONENT_TYPES),
    create: mock.fn(async (data) => ({ _id: I.margheritaPizza, isActive: true, ...data })),
    findById: mock.fn(async () => null),
    findByName: mock.fn(async () => null),
    update: mock.fn(async () => null),
    list: mock.fn(async () => []),
    search: mock.fn(async () => []),
  };

  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...createAuthMocks(),
    predefinedPizzaRepository: pizzaRepo,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, pizzaRepo };
}

/** Product name of a stored pizza (used to answer the searches by name). */
const productNameOf = (pizza) => PRODUCTS.find((p) => p.id === String(pizza.productId)).name;

/**
 * Programs the repository with the stored pizzas: findById / findByName / list / search / update
 * answer as the real repository would for that data.
 */
function storePizzas(pizzaRepo, pizzas) {
  const byId = (id) => pizzas.find((p) => String(p._id) === String(id));
  pizzaRepo.findById.mock.mockImplementation(async (id) => byId(id));
  pizzaRepo.findByName.mock.mockImplementation(async (name) =>
    pizzas.find((p) => productNameOf(p).toLowerCase() === name.trim().toLowerCase()),
  );
  pizzaRepo.list.mock.mockImplementation(async () => pizzas);
  pizzaRepo.search.mock.mockImplementation(async (name) =>
    pizzas.filter((p) => productNameOf(p).toLowerCase().includes(name.trim().toLowerCase())),
  );
  pizzaRepo.update.mock.mockImplementation(async (id, data) => ({ ...byId(id), ...data }));
}

/** Stored pizza document as created from a request body. */
const storedPizza = (_id, { productId, sizeIds, componentIds }, isActive = true) => ({
  _id,
  productId,
  sizeIds,
  defaultConfiguration: { componentIds },
  isActive,
});

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'StrongPassword123!' }),
  });
  const { accessToken: token } = await res.json();

  return async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status >= 500) console.error(`[HTTP ${res.status}] ${method} ${path}:`, await res.clone().text());
    return res;
  };
}

const validBody = (overrides = {}) => ({
  productId: I.pizzaProduct,
  sizeIds: [I.sizeSmall, I.sizeLarge],
  componentIds: [I.dough, I.sauce, I.cheese],
  ...overrides,
});

test('API /predefined-pizzas RBAC: Only MANAGER can create and update, EMPLOYEE can read', async (t) => {
  const { server, port, pizzaRepo } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const postEmp = await empRequest('POST', '/predefined-pizzas', validBody());
  assert.equal(postEmp.status, 403);
  assert.equal(pizzaRepo.create.mock.callCount(), 0);

  const postMgr = await managerRequest('POST', '/predefined-pizzas', validBody());
  assert.equal(postMgr.status, 201);
  const { id } = await postMgr.json();
  storePizzas(pizzaRepo, [storedPizza(id, validBody())]);

  const putEmp = await empRequest('PUT', `/predefined-pizzas/${id}`, { isActive: false });
  assert.equal(putEmp.status, 403);
  assert.equal(pizzaRepo.update.mock.callCount(), 0);

  assert.equal((await empRequest('GET', '/predefined-pizzas')).status, 200);
  assert.equal((await empRequest('GET', `/predefined-pizzas/${id}`)).status, 200);
  assert.equal((await empRequest('GET', '/predefined-pizzas/name/Margherita')).status, 200);
});

test('API /predefined-pizzas lifecycle and validations', async (t) => {
  const { server, port, pizzaRepo } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  assert.equal((await request('POST', '/predefined-pizzas', {})).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ productId: 'abc' }))).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ sizeIds: [] }))).status, 400);
  assert.equal((await request('POST', '/predefined-pizzas', validBody({ componentIds: undefined }))).status, 400);
  assert.equal(pizzaRepo.create.mock.callCount(), 0);

  const postRes = await request('POST', '/predefined-pizzas', validBody());
  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.ok(created.id);
  assert.equal(created.isActive, true);

  // Step: the pizza is stored; a second one for the same product breaks the unique index.
  storePizzas(pizzaRepo, [storedPizza(created.id, validBody())]);
  pizzaRepo.create.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { productId: 1 } });
  });
  const postDup = await request('POST', '/predefined-pizzas', validBody());
  assert.equal(postDup.status, 409);

  const getRes = await request('GET', `/predefined-pizzas/${created.id}`);
  assert.equal(getRes.status, 200);
  const details = await getRes.json();
  assert.equal(details.product.name, 'Margherita');
  assert.deepEqual(
    details.defaultConfiguration.components.map((c) => c.componentType.name),
    ['Base Dough', 'Base Sauce', 'Cheese'],
  );

  assert.equal((await request('GET', '/predefined-pizzas/abc')).status, 400);
  assert.equal((await request('GET', `/predefined-pizzas/${I.unknown}`)).status, 404);

  const getNameRes = await request('GET', '/predefined-pizzas/name/margherita');
  assert.equal(getNameRes.status, 200);
  assert.equal((await getNameRes.json()).id, created.id);
  assert.equal((await request('GET', '/predefined-pizzas/name/NaoExiste')).status, 404);

  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, {})).status, 400);
  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, { name: 'Outra' })).status, 400);
  assert.equal((await request('PUT', `/predefined-pizzas/${created.id}`, { isActive: true })).status, 400);
  assert.equal(pizzaRepo.update.mock.callCount(), 0);

  const putDeactivate = await request('PUT', `/predefined-pizzas/${created.id}`, { isActive: false });
  assert.equal(putDeactivate.status, 200);
  assert.equal((await putDeactivate.json()).isActive, false);
  assert.deepEqual(pizzaRepo.update.mock.calls[0].arguments, [created.id, { isActive: false }]);

  // Step: the pizza is now inactive.
  storePizzas(pizzaRepo, [storedPizza(created.id, validBody(), false)]);
  assert.equal((await request('GET', `/predefined-pizzas/${created.id}`)).status, 404);
  assert.equal((await request('GET', '/predefined-pizzas/name/Margherita')).status, 404);
});

test('API /predefined-pizzas enforces the default configuration rules', async (t) => {
  const { server, port, pizzaRepo } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const cases = [
    ['repeated component', { componentIds: [I.dough, I.sauce, I.cheese, I.cheese] }, 'more than once'],
    ['inactive component', { componentIds: [I.dough, I.sauce, I.inactiveTopping] }, 'active'],
    ['unknown component', { componentIds: [I.dough, I.sauce, I.unknown] }, 'not found'],
    ['below minQuantity (no dough)', { componentIds: [I.sauce, I.cheese] }, 'at least 1'],
    ['above maxQuantity (2 doughs)', { componentIds: [I.dough, I.doughExtra, I.sauce, I.cheese] }, 'at most 1'],
    ['above maxQuantity (2 cheeses)', { componentIds: [I.dough, I.sauce, I.cheese, I.cheeseExtra] }, 'at most 1'],
    ['size without Component Size Configuration', { componentIds: [I.dough, I.sauce, I.toppingNoLarge] }, 'Component Size Configuration'],
    ['inactive size', { sizeIds: [I.sizeSmall, I.sizeInactive] }, 'active'],
    ['product that is not sellable', { productId: I.dough }, 'sellable'],
  ];

  for (const [label, overrides, fragment] of cases) {
    const res = await request('POST', '/predefined-pizzas', validBody(overrides));
    assert.equal(res.status, 400, label);
    const body = await res.json();
    assert.ok(body.error.message.includes(fragment), `${label}: ${body.error.message}`);
  }
  assert.equal(pizzaRepo.create.mock.callCount(), 0);

  const ok = await request('POST', '/predefined-pizzas', validBody({
    componentIds: [I.dough, I.sauce, I.cheese, I.topping, I.toppingExtra],
  }));
  assert.equal(ok.status, 201);
  assert.equal(pizzaRepo.create.mock.callCount(), 1);
});

test('API /predefined-pizzas update revalidates the configuration', async (t) => {
  const { server, port, pizzaRepo } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const { id } = await (await request('POST', '/predefined-pizzas', validBody())).json();
  storePizzas(pizzaRepo, [storedPizza(id, validBody())]);

  const putBad = await request('PUT', `/predefined-pizzas/${id}`, { componentIds: [I.dough, I.sauce, I.inactiveTopping] });
  assert.equal(putBad.status, 400);
  assert.equal(pizzaRepo.update.mock.callCount(), 0);

  const putOk = await request('PUT', `/predefined-pizzas/${id}`, { componentIds: [I.dough, I.sauce, I.cheeseExtra] });
  assert.equal(putOk.status, 200);
  assert.deepEqual((await putOk.json()).defaultConfiguration.componentIds, [I.dough, I.sauce, I.cheeseExtra]);

  // Step: the stored pizza now has the new components.
  storePizzas(pizzaRepo, [
    storedPizza(id, validBody({ componentIds: [I.dough, I.sauce, I.cheeseExtra] })),
  ]);
  const putSizes = await request('PUT', `/predefined-pizzas/${id}`, { sizeIds: [I.sizeSmall] });
  assert.equal(putSizes.status, 200);
  assert.deepEqual((await putSizes.json()).sizeIds, [I.sizeSmall]);
  assert.deepEqual(pizzaRepo.update.mock.calls.at(-1).arguments[1], {
    sizeIds: [I.sizeSmall],
    defaultConfiguration: { componentIds: [I.dough, I.sauce, I.cheeseExtra] },
  });
});

test('API /predefined-pizzas returns only active pizzas and supports search by name', async (t) => {
  const { server, port, pizzaRepo } = await setupTestServer();
  t.after(() => { server.close(); server.closeAllConnections(); });

  const request = await loginAs(port, 'admin@laprizza.pt');

  // The repository holds an active Margherita and an inactive Pepperoni.
  const pepId = I.pepperoniPizza;
  storePizzas(pizzaRepo, [
    storedPizza(I.margheritaPizza, validBody()),
    storedPizza(pepId, validBody({ productId: I.pizzaProduct2 }), false),
  ]);

  const res = await request('GET', '/predefined-pizzas');
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 1);
  assert.equal(list.some((p) => p.id === pepId), false);

  assert.equal((await (await request('GET', '/predefined-pizzas?name=margh')).json()).length, 1);
  assert.equal((await (await request('GET', '/predefined-pizzas?name=pepp')).json()).length, 0);
  assert.equal((await request('GET', '/predefined-pizzas?name=')).status, 400);
  assert.deepEqual(
    pizzaRepo.search.mock.calls.map((c) => c.arguments[0]),
    ['margh', 'pepp'],
  );
});
