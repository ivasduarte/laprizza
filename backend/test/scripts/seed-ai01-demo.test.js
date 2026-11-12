import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData, validateSeedData, SeedError } from '../../scripts/seed-ai01-demo.js';
import { DomainError } from '../../src/domain/domain-error.js';

/**
 * The AI01 demo data (seed/ai01-demo.json) must pass every domain rule before it is written.
 * These checks run without a database.
 */
const data = await loadSeedData();
const clone = () => structuredClone(data);
const byName = (list, name) => list.find((p) => p.name === name);

const throwsSeedError = (mutate) => {
  const copy = clone();
  mutate(copy);
  assert.throws(() => validateSeedData(copy), SeedError);
};
const throwsDomainCode = (mutate, code) => {
  const copy = clone();
  mutate(copy);
  assert.throws(
    () => validateSeedData(copy),
    (err) => err instanceof DomainError && err.code === code,
  );
};

test('the demo data passes all validations', () => {
  validateSeedData(clone());
});

test('the demo data has the expected scenarios, all simulated with their own stock', () => {
  assert.deepEqual(
    data.scenarios.map((s) => s.code),
    ['DEMO-BASIC', 'DEMO-SUFFICIENT', 'DEMO-INSUFFICIENT', 'DEMO-PARTIAL'],
  );
  for (const scenario of data.scenarios) {
    assert.equal(scenario.simulated, true);
    assert.ok(Array.isArray(scenario.stock) && scenario.stock.length > 0, scenario.code);
  }
});

test('the demo data has one produced and one purchased aggregate', () => {
  const dough = byName(data.products, '[Demo] Massa');
  const sauce = byName(data.products, '[Demo] Molho');
  assert.equal(dough.aggregate.classification, 'PRODUCED');
  assert.equal(dough.aggregate.items.length, 3);
  assert.deepEqual(sauce.aggregate, { classification: 'PURCHASED', items: [] });
});

test('only stock controlled products have live stock', () => {
  const controlled = new Set(data.products.filter((p) => p.stockControlled).map((p) => p._id));
  for (const entry of data.stock) assert.ok(controlled.has(entry.productId), entry.productId);
});

test('every document uses the "[Demo] " prefix', () => {
  throwsSeedError((d) => {
    d.products[0].name = 'Massa';
  });
  throwsSeedError((d) => {
    d.scenarios[0].name = 'Basic';
  });
});

test('repeated or invalid ids are rejected', () => {
  throwsSeedError((d) => {
    d.sizes[1]._id = d.sizes[0]._id;
  });
  throwsSeedError((d) => {
    d.products[0]._id = 'not-an-id';
  });
});

test('live stock for a product without stock control is rejected', () => {
  throwsSeedError((d) => {
    d.stock.push({ productId: byName(d.products, '[Demo] Farinha')._id, quantity: 1 });
  });
});

test('aggregate rules apply to the demo data', () => {
  throwsDomainCode((d) => {
    byName(d.products, '[Demo] Molho').aggregate.items = [
      { productId: byName(d.products, '[Demo] Farinha')._id, quantity: 1 },
    ];
  }, 'AGGREGATE_PURCHASED_WITH_ITEMS');

  throwsDomainCode((d) => {
    byName(d.products, '[Demo] Massa').aggregate.items.push({
      productId: byName(d.products, '[Demo] Molho')._id,
      quantity: 1,
    });
  }, 'AGGREGATE_NESTED');
});

test('scenario rules apply to the demo data', () => {
  throwsDomainCode((d) => {
    d.scenarios[0].orders = [];
  }, 'SCENARIO_EMPTY_ORDERS');

  throwsDomainCode((d) => {
    d.scenarios[0].orders[0].sizeId = d.categories[0]._id;
  }, 'SCENARIO_SIZE_NOT_ALLOWED');
});

test('a product without stock control cannot define stock units consumed', () => {
  assert.throws(() => {
    const copy = clone();
    byName(copy.products, '[Demo] Orégãos').sizeConfigurations[0].stockUnitsConsumed = 1;
    validateSeedData(copy);
  }, DomainError);
});
