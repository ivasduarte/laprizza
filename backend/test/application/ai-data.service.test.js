import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSnapshot,
  buildSnapshot,
  buildBom,
  buildAggregates,
  buildScenarioSnapshot,
} from '../../src/application/ai-data/ai-data.service.js';
import { AppError } from '../../src/application/app-error.js';

const cfg = (pizzaSizeId, stockUnitsConsumed) => ({ pizzaSizeId, stockUnitsConsumed });
const seed = () => ({
  sizes: [
    { _id: 's', name: 'Small' },
    { _id: 'm', name: 'Medium' },
  ],
  products: [
    {
      _id: 'pz',
      name: 'Margherita',
      sellable: true,
      stockControlled: false,
      sizeConfigurations: [],
      customerEmail: 'must-not-leak@x.pt',
    },
    {
      _id: 'dough',
      name: 'Dough',
      stockControlled: true,
      pizzaComponentTypeId: 't1',
      sizeConfigurations: [cfg('s', 1), cfg('m', 0)],
    },
    {
      _id: 'cheese',
      name: 'Cheese',
      stockControlled: true,
      pizzaComponentTypeId: 't3',
      sizeConfigurations: [cfg('s', 80), cfg('m', null)],
    },
    {
      _id: 'basil',
      name: 'Basil',
      stockControlled: false,
      pizzaComponentTypeId: 't4',
      sizeConfigurations: [],
    },
  ],
  pizzas: [
    {
      productId: 'pz',
      sizeIds: ['s', 'm'],
      defaultConfiguration: { componentIds: ['dough', 'cheese', 'basil'] },
    },
  ],
  stock: [
    { productId: 'dough', quantity: 10 },
    { productId: 'cheese', quantity: -1 },
    { productId: 'ghost', quantity: 5 },
  ],
});

test('bom has one row per pizza/size/stock-controlled component', () => {
  const snap = buildSnapshot(seed());
  assert.deepEqual(
    snap.bom.filter((b) => b.sizeId === 's'),
    [
      { pizzaId: 'pz', sizeId: 's', componentId: 'cheese', quantity: 80 },
      { pizzaId: 'pz', sizeId: 's', componentId: 'dough', quantity: 1 },
    ],
  );
});

test('components that are not stock-controlled are left out without issues', () => {
  const snap = buildSnapshot(seed());
  assert.ok(!snap.bom.some((b) => b.componentId === 'basil'));
  assert.ok(!snap.issues.some((i) => i.componentId === 'basil'));
});

test('zero is a valid consumption (non-negative integer units)', () => {
  const snap = buildSnapshot(seed());
  assert.ok(
    snap.bom.some((b) => b.sizeId === 'm' && b.componentId === 'dough' && b.quantity === 0),
  );
});

test('missing or non-integer stock units are reported, not defaulted', () => {
  const snap = buildSnapshot(seed());
  assert.ok(!snap.bom.some((b) => b.sizeId === 'm' && b.componentId === 'cheese'));
  assert.deepEqual(
    snap.issues.find((i) => i.code === 'MISSING_OR_INVALID_STOCK_UNITS'),
    { code: 'MISSING_OR_INVALID_STOCK_UNITS', pizzaId: 'pz', sizeId: 'm', componentId: 'cheese' },
  );
  const s = seed();
  s.products[1].sizeConfigurations = [cfg('s', 1.5), cfg('m', 1)];
  assert.ok(buildSnapshot(s).issues.some((i) => i.componentId === 'dough' && i.sizeId === 's'));
});

test('invalid, unknown or non-controlled stock rows are reported and excluded', () => {
  const s = seed();
  s.stock.push({ productId: 'pz', quantity: 3 });
  const snap = buildSnapshot(s);
  assert.deepEqual(snap.stock, [{ productId: 'dough', quantity: 10 }]);
  const codes = snap.issues.map((i) => i.code);
  for (const c of ['STOCK_INVALID_QUANTITY', 'STOCK_UNKNOWN_PRODUCT', 'STOCK_NOT_CONTROLLED']) {
    assert.ok(codes.includes(c), c);
  }
});

test('snapshot exposes no customer data', () => {
  const snap = buildSnapshot(seed());
  assert.ok(!JSON.stringify(snap).includes('must-not-leak'));
  assert.deepEqual(Object.keys(snap.products[0]).sort(), [
    'id',
    'isPizzaComponent',
    'name',
    'sellable',
    'stockControlled',
  ]);
});

test('snapshotId depends on content only, not on order or time', () => {
  const a = buildSnapshot(seed(), new Date('2026-11-01'));
  const s = seed();
  s.products.reverse();
  s.stock.reverse();
  const b = buildSnapshot(s, new Date('2026-11-09'));
  assert.equal(a.meta.snapshotId, b.meta.snapshotId);
  s.stock.find((x) => x.productId === 'dough').quantity = 999;
  assert.notEqual(buildSnapshot(s).meta.snapshotId, a.meta.snapshotId);
});

test('service reads all sources and stamps the retrieval time', async () => {
  const d = seed();
  const repo = {
    listProducts: async () => d.products,
    listSizes: async () => d.sizes,
    listPredefinedPizzas: async () => d.pizzas,
    listStock: async () => d.stock,
    getActiveForecast: async () => null,
    getActiveSupplierScenario: async () => null,
  };
  const snap = await getSnapshot(repo, () => new Date('2026-11-01T10:00:00Z'));
  assert.equal(snap.meta.retrievedAt, '2026-11-01T10:00:00.000Z');
  assert.equal(snap.meta.simulated, false);
  assert.equal(snap.forecast, null);
  assert.equal(snap.supplierScenario, null);
});

// ---------------------------------------------------------------------------------------------
// AI01: snapshot of a BOM scenario (scenarioId + stockMode)
// ---------------------------------------------------------------------------------------------

const scenarioData = () => {
  const d = seed();
  // Dough is an aggregate produced from flour; sauce is a purchased aggregate.
  d.products.push(
    { _id: 'flour', name: 'Flour', stockControlled: false },
    {
      _id: 'sauce',
      name: 'Sauce',
      stockControlled: true,
      pizzaComponentTypeId: 't2',
      sizeConfigurations: [cfg('s', 1), cfg('m', 1)],
      aggregate: { classification: 'PURCHASED', items: [] },
    },
  );
  d.products.find((p) => p._id === 'dough').aggregate = {
    classification: 'PRODUCED',
    items: [{ productId: 'flour', quantity: 2 }],
  };
  d.products.find((p) => p._id === 'cheese').sizeConfigurations = [cfg('s', 1), cfg('m', 2)];
  d.pizzas[0].defaultConfiguration.componentIds.push('sauce');
  return d;
};

const SCENARIO = {
  code: 'DEMO-X',
  name: '[Demo] X',
  version: 3,
  simulated: true,
  orders: [{ pizzaId: 'pz', sizeId: 'm', quantity: 2 }],
  stock: [
    { productId: 'sauce', quantity: 4 },
    { productId: 'dough', quantity: 1 },
  ],
};

const scenarioRepo = (d = scenarioData(), scenario = SCENARIO) => {
  const calls = { listStock: 0, forecast: 0, supplierScenario: 0 };
  return {
    calls,
    listProducts: async () => d.products,
    listSizes: async () => d.sizes,
    listPredefinedPizzas: async () => d.pizzas,
    listStock: async () => {
      calls.listStock += 1;
      return d.stock;
    },
    getActiveForecast: async () => {
      calls.forecast += 1;
      return null;
    },
    getActiveSupplierScenario: async () => {
      calls.supplierScenario += 1;
      return null;
    },
    findActiveScenarioByCode: async (code) => (code === scenario?.code ? scenario : null),
  };
};

const NOW = () => new Date('2026-11-12T10:00:00Z');

test('buildBom reports components without stock control and without consumption (AI01 only)', () => {
  const d = seed();
  const byId = new Map(d.products.map((p) => [p._id, p]));

  const plain = buildBom(d.pizzas, byId);
  assert.ok(!plain.issues.some((i) => i.componentId === 'basil'));

  const ai01 = buildBom(d.pizzas, byId, { reportUnmeasured: true });
  assert.deepEqual(
    ai01.issues.filter((i) => i.componentId === 'basil'),
    [
      { code: 'UNMEASURED_NON_STOCK_COMPONENT', pizzaId: 'pz', sizeId: 's', componentId: 'basil' },
      { code: 'UNMEASURED_NON_STOCK_COMPONENT', pizzaId: 'pz', sizeId: 'm', componentId: 'basil' },
    ],
  );
  assert.ok(!ai01.bom.some((b) => b.componentId === 'basil'));
});

test('buildBom keeps a component without stock control that defines a consumption (AI01 only)', () => {
  const d = seed();
  d.products.find((p) => p._id === 'basil').sizeConfigurations = [cfg('s', 1)];
  const { bom, issues } = buildBom(d.pizzas, new Map(d.products.map((p) => [p._id, p])), {
    reportUnmeasured: true,
  });
  assert.deepEqual(
    bom.find((b) => b.componentId === 'basil'),
    { pizzaId: 'pz', sizeId: 's', componentId: 'basil', quantity: 1 },
  );
  assert.ok(issues.some((i) => i.componentId === 'basil' && i.sizeId === 'm'));
});

test('buildAggregates maps the classification and the items of each aggregate', () => {
  assert.deepEqual(buildAggregates(scenarioData().products), [
    { id: 'dough', classification: 'production', items: [{ componentId: 'flour', quantity: 2 }] },
    { id: 'sauce', classification: 'purchase', items: [] },
  ]);
});

test('scenario snapshot: scenario, orders, pizzas and sources (stockMode scenario)', () => {
  const d = scenarioData();
  const snap = buildScenarioSnapshot({ ...d, scenario: SCENARIO }, 'scenario', NOW());

  assert.deepEqual(snap.scenario, {
    id: 'DEMO-X',
    name: '[Demo] X',
    version: 3,
    simulated: true,
    stockMode: 'scenario',
  });
  assert.deepEqual(snap.orders, [
    { id: 'DEMO-X#1', simulated: true, items: [{ pizzaId: 'pz', sizeId: 'm', quantity: 2 }] },
  ]);
  assert.deepEqual(snap.pizzas, [{ id: 'pz', sizeIds: ['s', 'm'] }]);
  assert.equal(snap.aggregates.length, 2);
  assert.equal(snap.meta.simulated, true);
  assert.equal(snap.meta.source, 'backend');
  assert.match(snap.meta.snapshotId, /^[0-9a-f]{16}$/);
  assert.match(snap.meta.sources.catalogue.version, /^[0-9a-f]{16}$/);
  assert.deepEqual(snap.meta.sources.stock, {
    source: 'scenario',
    scenarioId: 'DEMO-X',
    scenarioVersion: 3,
    retrievedAt: '2026-11-12T10:00:00.000Z',
  });
  assert.deepEqual(snap.meta.sources.orders, { ...snap.meta.sources.stock });
  // forecast and supplierScenario are not used by the BOM calculation
  assert.equal(snap.forecast, null);
  assert.equal(snap.supplierScenario, null);
});

test('scenario snapshot: the stock is exactly the stock of the scenario', () => {
  const snap = buildScenarioSnapshot(
    { ...scenarioData(), scenario: SCENARIO },
    'scenario',
    NOW(),
  );
  assert.deepEqual(snap.stock, [
    { productId: 'dough', quantity: 1 },
    { productId: 'sauce', quantity: 4 },
  ]);
  assert.ok(!snap.issues.some((i) => i.code.startsWith('STOCK_')));
});

test('scenario snapshot: live stock lists every stock-controlled product, 0 when there is no record', () => {
  const snap = buildScenarioSnapshot({ ...scenarioData(), scenario: SCENARIO }, 'live', NOW());
  // dough 10 (record), cheese -1 (invalid -> 0 and issue), sauce (no record -> 0)
  assert.deepEqual(snap.stock, [
    { productId: 'cheese', quantity: 0 },
    { productId: 'dough', quantity: 10 },
    { productId: 'sauce', quantity: 0 },
  ]);
  assert.deepEqual(snap.meta.sources.stock, {
    source: 'backend-live',
    retrievedAt: '2026-11-12T10:00:00.000Z',
  });
  const codes = snap.issues.map((i) => i.code);
  assert.ok(codes.includes('STOCK_INVALID_QUANTITY'));
  assert.ok(codes.includes('STOCK_UNKNOWN_PRODUCT'));
  assert.equal(snap.scenario.stockMode, 'live');
});

test('scenario snapshot: the BOM reports components without stock control and no consumption', () => {
  const snap = buildScenarioSnapshot(
    { ...scenarioData(), scenario: SCENARIO },
    'scenario',
    NOW(),
  );
  assert.ok(snap.issues.some((i) => i.code === 'UNMEASURED_NON_STOCK_COMPONENT'));
  assert.ok(snap.bom.some((b) => b.componentId === 'sauce'));
});

test('scenario snapshot: snapshotId depends on content only, and exposes no customer data', () => {
  const a = buildScenarioSnapshot({ ...scenarioData(), scenario: SCENARIO }, 'scenario', NOW());
  const b = buildScenarioSnapshot(
    { ...scenarioData(), scenario: SCENARIO },
    'scenario',
    new Date('2026-12-01'),
  );
  assert.equal(a.meta.snapshotId, b.meta.snapshotId);
  const live = buildScenarioSnapshot({ ...scenarioData(), scenario: SCENARIO }, 'live', NOW());
  assert.notEqual(live.meta.snapshotId, a.meta.snapshotId);
  assert.ok(!JSON.stringify(a).includes('must-not-leak'));
});

test('getSnapshot with scenarioId: unknown or inactive scenario is 404 AI_SCENARIO_NOT_FOUND', async () => {
  await assert.rejects(
    getSnapshot(scenarioRepo(), NOW, { scenarioId: 'DEMO-NOPE', stockMode: 'scenario' }),
    (err) => err instanceof AppError && err.status === 404 && err.code === 'AI_SCENARIO_NOT_FOUND',
  );
});

test('getSnapshot with scenarioId: a scenario without stock is 400 SCENARIO_WITHOUT_STOCK in scenario mode only', async () => {
  const noStock = { ...SCENARIO, stock: null };
  await assert.rejects(
    getSnapshot(scenarioRepo(scenarioData(), noStock), NOW, {
      scenarioId: 'DEMO-X',
      stockMode: 'scenario',
    }),
    (err) => err instanceof AppError && err.status === 400 && err.code === 'SCENARIO_WITHOUT_STOCK',
  );
  const live = await getSnapshot(scenarioRepo(scenarioData(), noStock), NOW, {
    scenarioId: 'DEMO-X',
    stockMode: 'live',
  });
  assert.equal(live.scenario.stockMode, 'live');
});

test('getSnapshot with scenarioId: reads the current data every time (no cache)', async () => {
  const d = scenarioData();
  const repo = scenarioRepo(d);
  const params = { scenarioId: 'DEMO-X', stockMode: 'live' };
  const first = await getSnapshot(repo, NOW, params);
  d.stock.find((s) => s.productId === 'dough').quantity = 7;
  const second = await getSnapshot(repo, NOW, params);

  assert.equal(first.stock.find((s) => s.productId === 'dough').quantity, 10);
  assert.equal(second.stock.find((s) => s.productId === 'dough').quantity, 7);
  assert.equal(repo.calls.listStock, 2);
  assert.equal(repo.calls.forecast, 0);
  assert.equal(repo.calls.supplierScenario, 0);
});

test('getSnapshot with scenarioId: scenario mode does not read the real stock', async () => {
  const repo = scenarioRepo();
  await getSnapshot(repo, NOW, { scenarioId: 'DEMO-X', stockMode: 'scenario' });
  assert.equal(repo.calls.listStock, 0);
});
