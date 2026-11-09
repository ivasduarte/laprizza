import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupplierScenario,
  getSupplierScenarioById,
  listSupplierScenarios,
  updateSupplierScenario,
} from '../../src/application/supplier-scenario/supplier-scenario.service.js';

const SCENARIO_ID = '5ce4a0000000000000000001';
const PRODUCT_ID = 'd0d0c7000000000000000001';

const duplicateKeyError = () => Object.assign(new Error('Duplicate key'), { code: 11000 });

const scenarioData = () => ({
  name: 'Cenário Base',
  version: 1,
  simulated: true,
  suppliers: [{ id: 'SUP-1', name: 'Fornecedor A' }],
  products: [
    {
      productId: PRODUCT_ID,
      offers: [
        { supplierId: 'SUP-1', priceEur: 1.5, stockUnits: 100, leadTimeDays: 2, supplyLimit: 50 },
      ],
    },
  ],
});

test('createSupplierScenario stores as active and maps DTO', async () => {
  const scenarioRepository = {
    create: mock.fn(async (data) => ({ _id: SCENARIO_ID, ...data })),
  };

  const scenario = await createSupplierScenario(scenarioData(), scenarioRepository);

  assert.equal(scenarioRepository.create.mock.callCount(), 1);
  assert.deepEqual(scenarioRepository.create.mock.calls[0].arguments[0], {
    ...scenarioData(),
    isActive: true,
  });
  assert.ok(scenario.id);
  assert.equal(scenario.name, 'Cenário Base');
  assert.equal(scenario.version, 1);
  assert.equal(scenario.simulated, true);
  assert.equal(scenario.suppliers.length, 1);
  assert.equal(scenario.products.length, 1);
  assert.equal(scenario.isActive, true);
  assert.equal(scenario._id, undefined);
});

test('createSupplierScenario rejects duplicate names', async () => {
  const scenarioRepository = {
    create: mock.fn(async () => {
      throw duplicateKeyError();
    }),
  };

  await assert.rejects(
    async () => await createSupplierScenario(scenarioData(), scenarioRepository),
    (err) => err.status === 409 && err.message.includes('already in use'),
  );
  assert.equal(scenarioRepository.create.mock.callCount(), 1);
});

test('createSupplierScenario rethrows unexpected repository errors', async () => {
  const scenarioRepository = {
    create: mock.fn(async () => {
      throw new Error('Connection lost');
    }),
  };

  await assert.rejects(
    async () => await createSupplierScenario(scenarioData(), scenarioRepository),
    (err) => err.message === 'Connection lost',
  );
});

test('getSupplierScenarioById and listSupplierScenarios filter inactives and map DTO', async () => {
  const inactive = { _id: SCENARIO_ID, ...scenarioData(), isActive: false };
  const scenarioRepository = {
    findById: mock.fn(async () => inactive),
    list: mock.fn(async () => [inactive]),
    search: mock.fn(async () => []),
  };

  await assert.rejects(
    async () => await getSupplierScenarioById(SCENARIO_ID, scenarioRepository),
    (err) => err.status === 404,
  );
  assert.equal(scenarioRepository.findById.mock.calls[0].arguments[0], SCENARIO_ID);

  const list = await listSupplierScenarios({}, scenarioRepository);
  assert.equal(list.length, 0);
  assert.equal(scenarioRepository.list.mock.callCount(), 1);
  assert.equal(scenarioRepository.search.mock.callCount(), 0);
});

test('getSupplierScenarioById rejects missing scenarios and maps active ones', async () => {
  const stored = { _id: SCENARIO_ID, ...scenarioData(), isActive: true };
  const scenarioRepository = {
    findById: mock.fn(async (id) => (id === SCENARIO_ID ? stored : null)),
  };

  await assert.rejects(
    async () => await getSupplierScenarioById('5ce4a0000000000000000099', scenarioRepository),
    (err) => err.status === 404,
  );

  const scenario = await getSupplierScenarioById(SCENARIO_ID, scenarioRepository);
  assert.equal(scenario.id, SCENARIO_ID);
  assert.equal(scenario.name, 'Cenário Base');
  assert.equal(scenario._id, undefined);
});

test('listSupplierScenarios uses search when a name filter is given', async () => {
  const active = { _id: SCENARIO_ID, ...scenarioData(), isActive: true };
  const scenarioRepository = {
    list: mock.fn(async () => []),
    search: mock.fn(async () => [active]),
  };

  const list = await listSupplierScenarios({ name: 'base' }, scenarioRepository);

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Cenário Base');
  assert.equal(scenarioRepository.search.mock.calls[0].arguments[0], 'base');
  assert.equal(scenarioRepository.list.mock.callCount(), 0);
});

test('updateSupplierScenario allows only deactivation', async () => {
  const active = { _id: SCENARIO_ID, ...scenarioData(), isActive: true };
  const scenarioRepository = {
    findById: mock.fn(async () => active),
    update: mock.fn(async (_id, data) => ({ ...active, ...data })),
  };

  await assert.rejects(
    async () => await updateSupplierScenario(SCENARIO_ID, { name: 'Outro' }, scenarioRepository),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );
  assert.equal(scenarioRepository.findById.mock.callCount(), 0);
  assert.equal(scenarioRepository.update.mock.callCount(), 0);

  const deactivated = await updateSupplierScenario(
    SCENARIO_ID,
    { isActive: false },
    scenarioRepository,
  );
  assert.equal(deactivated.isActive, false);
  assert.deepEqual(scenarioRepository.update.mock.calls[0].arguments, [
    SCENARIO_ID,
    { isActive: false },
  ]);
});

test('updateSupplierScenario rejects missing or already inactive scenarios', async () => {
  const scenarioRepository = {
    findById: mock.fn(async () => null),
    update: mock.fn(async () => null),
  };

  await assert.rejects(
    async () => await updateSupplierScenario(SCENARIO_ID, { isActive: false }, scenarioRepository),
    (err) => err.status === 404,
  );

  scenarioRepository.findById.mock.mockImplementation(async () => ({
    _id: SCENARIO_ID,
    ...scenarioData(),
    isActive: false,
  }));
  await assert.rejects(
    async () => await updateSupplierScenario(SCENARIO_ID, { isActive: false }, scenarioRepository),
    (err) => err.status === 404,
  );
  assert.equal(scenarioRepository.update.mock.callCount(), 0);
});
