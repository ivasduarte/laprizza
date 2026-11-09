import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSnapshot, buildSnapshot } from '../../src/application/ai-data/ai-data.service.js';

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
