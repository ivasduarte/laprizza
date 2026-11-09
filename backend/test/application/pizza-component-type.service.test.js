import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  listPizzaComponentTypes,
  createPizzaComponentType,
  getPizzaComponentTypeById,
  updatePizzaComponentType,
  removePizzaComponentType,
  toPizzaComponentTypeDTO,
} from '../../src/application/pizza-component-type/pizza-component-type.service.js';

// Valid identifier format (24 hex characters) that does not belong to any category
const NON_EXISTENT_ID = 'abcdef000000000000000999';
const CHEESE_ID = 'abcdef000000000000000001';
const TOPPING_ID = 'abcdef000000000000000002';

const CHEESE = { name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 };
const TOPPING = { name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null };

const duplicateKeyError = (keyPattern) =>
  Object.assign(new Error('Duplicate Key'), { code: 11000, keyPattern });

/** Repository whose create echoes the payload as a stored, active document. */
const createTypesRepository = () => ({
  create: mock.fn(async (data) => ({ _id: CHEESE_ID, ...data, isActive: true })),
});

/** Repository that knows only `type` (findById) and merges updates into it. */
const repositoryWith = (type) => ({
  findById: mock.fn(async (id) => (type && String(id) === String(type._id) ? type : null)),
  update: mock.fn(async (_id, data) => ({ ...type, ...data })),
});

const productsRepositoryReferencing = (isReferenced) => ({
  existsByPizzaComponentType: mock.fn(async () => isReferenced),
});

test('toPizzaComponentTypeDTO exposes the identifier as id and hides database fields', () => {
  const dto = toPizzaComponentTypeDTO({ _id: 'abc', __v: 0, ...CHEESE, isActive: true });

  assert.deepEqual(dto, { id: 'abc', ...CHEESE, isActive: true });
  assert.equal(dto._id, undefined);
  assert.equal(dto.__v, undefined);
});

test('createPizzaComponentType saves a normalized name and returns an active DTO', async () => {
  const repo = createTypesRepository();

  const created = await createPizzaComponentType({ ...CHEESE, name: '  Extra   Cheese ' }, repo);

  assert.equal(repo.create.mock.callCount(), 1);
  assert.deepEqual(repo.create.mock.calls[0].arguments[0], { ...CHEESE, name: 'Extra Cheese' });
  assert.ok(created.id);
  assert.equal(created.name, 'Extra Cheese');
  assert.equal(created.assemblyOrder, 3);
  assert.equal(created.minQuantity, 0);
  assert.equal(created.maxQuantity, 1);
  assert.equal(created.isActive, true);
  assert.equal(created._id, undefined);
});

test('createPizzaComponentType treats an omitted or null maximum as unbounded', async () => {
  const repo = createTypesRepository();

  const omitted = await createPizzaComponentType(
    { name: 'Topping', assemblyOrder: 4, minQuantity: 0 },
    repo,
  );
  const explicitNull = await createPizzaComponentType(
    { name: 'Extras', assemblyOrder: 5, minQuantity: 0, maxQuantity: null },
    repo,
  );

  assert.equal(omitted.maxQuantity, null);
  assert.equal(explicitNull.maxQuantity, null);
  assert.equal(repo.create.mock.calls[0].arguments[0].maxQuantity, null);
  assert.equal(repo.create.mock.calls[1].arguments[0].maxQuantity, null);
});

test('createPizzaComponentType accepts a minimum equal to the maximum', async () => {
  const repo = createTypesRepository();

  const created = await createPizzaComponentType(
    { name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
    repo,
  );

  assert.equal(created.minQuantity, 1);
  assert.equal(created.maxQuantity, 1);
});

test('createPizzaComponentType rejects invalid data without saving', async () => {
  const repo = createTypesRepository();

  const invalidData = [
    {},
    { ...CHEESE, name: '   ' },
    { ...CHEESE, name: undefined },
    { ...CHEESE, assemblyOrder: 0 },
    { ...CHEESE, assemblyOrder: undefined },
    { ...CHEESE, assemblyOrder: 1.5 },
    { ...CHEESE, minQuantity: -1 },
    { ...CHEESE, minQuantity: undefined },
    { ...CHEESE, maxQuantity: 0 },
    { ...CHEESE, maxQuantity: 1.5 },
    { ...CHEESE, minQuantity: 2, maxQuantity: 1 },
  ];

  for (const data of invalidData) {
    await assert.rejects(
      async () => await createPizzaComponentType(data, repo),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assert.equal(repo.create.mock.callCount(), 0);
});

test('createPizzaComponentType returns 409 Conflict on duplicate name', async () => {
  const repo = createTypesRepository();
  repo.create.mock.mockImplementation(async () => {
    throw duplicateKeyError({ name: 1 });
  });

  await assert.rejects(
    async () => await createPizzaComponentType({ ...CHEESE, name: 'CAFE', assemblyOrder: 9 }, repo),
    (err) => err.status === 409 && /name/i.test(err.message),
  );

  assert.equal(repo.create.mock.callCount(), 1);
});

test('createPizzaComponentType returns 409 Conflict on duplicate assembly order', async () => {
  const repo = createTypesRepository();
  repo.create.mock.mockImplementation(async () => {
    throw duplicateKeyError({ assemblyOrder: 1 });
  });

  await assert.rejects(
    async () => await createPizzaComponentType({ ...TOPPING, assemblyOrder: 3 }, repo),
    (err) => err.status === 409 && /assembly order/i.test(err.message),
  );

  assert.equal(repo.create.mock.callCount(), 1);
});

test('createPizzaComponentType rethrows errors that are not duplicates', async () => {
  const repo = createTypesRepository();
  repo.create.mock.mockImplementation(async () => {
    throw new Error('Database offline');
  });

  await assert.rejects(
    async () => await createPizzaComponentType(CHEESE, repo),
    (err) => err.message === 'Database offline' && err.status === undefined,
  );
});

test('listPizzaComponentTypes without a name returns the active types sorted by assembly order', async () => {
  const repo = {
    listPizzaComponentTypes: mock.fn(async () => [
      { _id: CHEESE_ID, ...CHEESE, isActive: true },
      { _id: TOPPING_ID, ...TOPPING, isActive: true },
    ]),
    searchByName: mock.fn(),
  };

  const types = await listPizzaComponentTypes(undefined, repo);

  assert.ok(Array.isArray(types));
  assert.deepEqual(
    types.map((t) => t.name),
    ['Cheese', 'Topping'],
  );
  assert.ok(types[0].id);
  assert.equal(types[0]._id, undefined);
  assert.equal(repo.listPizzaComponentTypes.mock.callCount(), 1);
  assert.equal(repo.searchByName.mock.callCount(), 0);
});

test('listPizzaComponentTypes without a name does not return removed types', async () => {
  // The repository list only returns active types.
  const repo = {
    listPizzaComponentTypes: mock.fn(async () => [{ _id: TOPPING_ID, ...TOPPING, isActive: true }]),
  };

  const types = await listPizzaComponentTypes(undefined, repo);

  assert.deepEqual(
    types.map((t) => t.name),
    ['Topping'],
  );
});

test('listPizzaComponentTypes finds the exact name ignoring case and accents', async () => {
  const repo = {
    listPizzaComponentTypes: mock.fn(),
    searchByName: mock.fn(async () => [{ _id: CHEESE_ID, ...CHEESE, name: 'Café', isActive: true }]),
  };

  const found = await listPizzaComponentTypes('cafe', repo);

  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Café');
  assert.equal(repo.searchByName.mock.calls[0].arguments[0], 'cafe');
  assert.equal(repo.listPizzaComponentTypes.mock.callCount(), 0);
});

test('listPizzaComponentTypes finds a removed type by name and flags it as inactive', async () => {
  const repo = {
    searchByName: mock.fn(async () => [{ _id: CHEESE_ID, ...CHEESE, isActive: false }]),
  };

  const found = await listPizzaComponentTypes('cheese', repo);

  assert.equal(found.length, 1);
  assert.equal(found[0].isActive, false);
});

test('listPizzaComponentTypes returns an empty list for partial or blank names', async () => {
  const repo = { searchByName: mock.fn(async () => []) };

  assert.deepEqual(await listPizzaComponentTypes('chee', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('Ch', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('', repo), []);
  assert.deepEqual(await listPizzaComponentTypes('   ', repo), []);
  assert.equal(repo.searchByName.mock.callCount(), 4);
});

test('getPizzaComponentTypeById returns the type or throws 404', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });

  const found = await getPizzaComponentTypeById(CHEESE_ID, repo);
  assert.deepEqual(found, { id: CHEESE_ID, ...CHEESE, isActive: true });

  await assert.rejects(
    async () => await getPizzaComponentTypeById(NON_EXISTENT_ID, repo),
    (err) => err.status === 404,
  );
});

test('getPizzaComponentTypeById also returns a removed type, flagged as inactive', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: false });

  const found = await getPizzaComponentTypeById(CHEESE_ID, repo);

  assert.equal(found.id, CHEESE_ID);
  assert.equal(found.isActive, false);
});

test('updatePizzaComponentType changes all the properties', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });

  const updated = await updatePizzaComponentType(
    CHEESE_ID,
    { name: '  Extra   Cheese ', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
    repo,
  );

  assert.equal(updated.id, CHEESE_ID);
  assert.equal(updated.name, 'Extra Cheese');
  assert.equal(updated.assemblyOrder, 7);
  assert.equal(updated.minQuantity, 1);
  assert.equal(updated.maxQuantity, null);
  assert.equal(updated.isActive, true);
  assert.deepEqual(repo.update.mock.calls[0].arguments, [
    CHEESE_ID,
    { name: 'Extra Cheese', assemblyOrder: 7, minQuantity: 1, maxQuantity: null },
  ]);
});

test('updatePizzaComponentType keeps its own assembly order and allows changing only the case of its name', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });

  const updated = await updatePizzaComponentType(CHEESE_ID, { ...CHEESE, name: 'cheese' }, repo);

  assert.equal(updated.name, 'cheese');
  assert.equal(updated.assemblyOrder, 3);
});

test('updatePizzaComponentType rejects invalid data without changing the type', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });

  for (const data of [{}, { ...CHEESE, name: '  ' }, { ...CHEESE, minQuantity: 5, maxQuantity: 2 }]) {
    await assert.rejects(
      async () => await updatePizzaComponentType(CHEESE_ID, data, repo),
      (err) => err.status === 400,
      JSON.stringify(data),
    );
  }

  assert.equal(repo.findById.mock.callCount(), 0);
  assert.equal(repo.update.mock.callCount(), 0);
});

test('updatePizzaComponentType returns 409 Conflict on duplicate name', async () => {
  const repo = repositoryWith({ _id: TOPPING_ID, ...TOPPING, isActive: true });
  repo.update.mock.mockImplementation(async () => {
    throw duplicateKeyError({ name: 1 });
  });

  await assert.rejects(
    async () => await updatePizzaComponentType(TOPPING_ID, { ...TOPPING, name: 'CHEESE' }, repo),
    (err) => err.status === 409 && /name/i.test(err.message),
  );
});

test('updatePizzaComponentType returns 409 Conflict on duplicate assembly order', async () => {
  const repo = repositoryWith({ _id: TOPPING_ID, ...TOPPING, isActive: true });
  repo.update.mock.mockImplementation(async () => {
    throw duplicateKeyError({ assemblyOrder: 1 });
  });

  await assert.rejects(
    async () => await updatePizzaComponentType(TOPPING_ID, { ...TOPPING, assemblyOrder: 3 }, repo),
    (err) => err.status === 409 && /assembly order/i.test(err.message),
  );
});

test('updatePizzaComponentType throws 404 if the type does not exist', async () => {
  const repo = repositoryWith(null);

  await assert.rejects(
    async () => await updatePizzaComponentType(NON_EXISTENT_ID, CHEESE, repo),
    (err) => err.status === 404,
  );
  assert.equal(repo.update.mock.callCount(), 0);
});

test('updatePizzaComponentType validates the data before looking for the type', async () => {
  const repo = repositoryWith(null);

  await assert.rejects(
    async () => await updatePizzaComponentType(NON_EXISTENT_ID, { name: '' }, repo),
    (err) => err.status === 400,
  );
  assert.equal(repo.findById.mock.callCount(), 0);
});

test('updatePizzaComponentType throws 404 for a removed type and leaves it unchanged', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: false });

  await assert.rejects(
    async () => await updatePizzaComponentType(CHEESE_ID, { ...CHEESE, name: 'Other' }, repo),
    (err) => err.status === 404,
  );

  assert.equal(repo.update.mock.callCount(), 0);
});

test('removePizzaComponentType deactivates the type without deleting it', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });
  const productsRepo = productsRepositoryReferencing(false);

  const result = await removePizzaComponentType(CHEESE_ID, repo, productsRepo);

  assert.equal(result, undefined);
  assert.deepEqual(repo.update.mock.calls[0].arguments, [CHEESE_ID, { isActive: false }]);
});

test('removePizzaComponentType throws 404 if the type does not exist', async () => {
  const repo = repositoryWith(null);
  const productsRepo = productsRepositoryReferencing(false);

  await assert.rejects(
    async () => await removePizzaComponentType(NON_EXISTENT_ID, repo, productsRepo),
    (err) => err.status === 404,
  );
});

test('removePizzaComponentType throws 404 if the type was already removed', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: false });
  const productsRepo = productsRepositoryReferencing(false);

  await assert.rejects(
    async () => await removePizzaComponentType(CHEESE_ID, repo, productsRepo),
    (err) => err.status === 404,
  );
  assert.equal(repo.update.mock.callCount(), 0);
});

test('removing a type frees its name and assembly order to be used again', async () => {
  // The unique indexes only cover active types, so the same data is accepted again.
  const repo = createTypesRepository();
  repo.create.mock.mockImplementation(async (data) => ({ _id: TOPPING_ID, ...data, isActive: true }));

  const recreated = await createPizzaComponentType(CHEESE, repo);

  assert.notEqual(recreated.id, CHEESE_ID);
  assert.equal(recreated.isActive, true);
  assert.deepEqual(repo.create.mock.calls[0].arguments[0], CHEESE);
});

test('removePizzaComponentType throws 409 Conflict if a product references the type', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });
  const productsRepo = productsRepositoryReferencing(true);

  await assert.rejects(
    async () => await removePizzaComponentType(CHEESE_ID, repo, productsRepo),
    (err) => err.status === 409 && /referenced/i.test(err.message),
  );

  // The type is still active: it was never updated
  assert.equal(productsRepo.existsByPizzaComponentType.mock.calls[0].arguments[0], CHEESE_ID);
  assert.equal(repo.update.mock.callCount(), 0);
});

test('removePizzaComponentType ignores inactive products', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });
  // existsByPizzaComponentType only counts active products.
  const productsRepo = productsRepositoryReferencing(false);

  await removePizzaComponentType(CHEESE_ID, repo, productsRepo);

  assert.deepEqual(repo.update.mock.calls[0].arguments[1], { isActive: false });
});

test('removePizzaComponentType only checks the products of the type being removed', async () => {
  const types = {
    [CHEESE_ID]: { _id: CHEESE_ID, ...CHEESE, isActive: true },
    [TOPPING_ID]: { _id: TOPPING_ID, ...TOPPING, isActive: true },
  };
  const repo = {
    findById: mock.fn(async (id) => types[id] ?? null),
    update: mock.fn(async (id, data) => ({ ...types[id], ...data })),
  };
  const productsRepo = {
    existsByPizzaComponentType: mock.fn(async (id) => id === CHEESE_ID),
  };

  // The topping type has no products: it can be removed, the cheese type cannot
  assert.equal(await removePizzaComponentType(TOPPING_ID, repo, productsRepo), undefined);
  assert.deepEqual(repo.update.mock.calls[0].arguments, [TOPPING_ID, { isActive: false }]);
  await assert.rejects(
    async () => await removePizzaComponentType(CHEESE_ID, repo, productsRepo),
    (err) => err.status === 409,
  );
  assert.deepEqual(
    productsRepo.existsByPizzaComponentType.mock.calls.map((c) => c.arguments[0]),
    [TOPPING_ID, CHEESE_ID],
  );
  assert.equal(repo.update.mock.callCount(), 1);
});

test('removePizzaComponentType removes the type once no product references it', async () => {
  const repo = repositoryWith({ _id: CHEESE_ID, ...CHEESE, isActive: true });
  const productsRepo = productsRepositoryReferencing(true);

  await assert.rejects(
    async () => await removePizzaComponentType(CHEESE_ID, repo, productsRepo),
    (err) => err.status === 409,
  );

  // The product stops being a pizza component
  productsRepo.existsByPizzaComponentType.mock.mockImplementation(async () => false);

  assert.equal(await removePizzaComponentType(CHEESE_ID, repo, productsRepo), undefined);
  assert.deepEqual(repo.update.mock.calls[0].arguments[1], { isActive: false });
});

test('removePizzaComponentType checks that the type exists before looking at the products', async () => {
  const repo = repositoryWith(null);
  const productsRepo = productsRepositoryReferencing(false);

  await assert.rejects(
    async () => await removePizzaComponentType(NON_EXISTENT_ID, repo, productsRepo),
    (err) => err.status === 404,
  );
  assert.equal(productsRepo.existsByPizzaComponentType.mock.callCount(), 0);
});
