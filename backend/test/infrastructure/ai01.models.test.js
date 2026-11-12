import test from 'node:test';
import assert from 'node:assert/strict';
import Products from '../../src/infrastructure/products/products.model.js';
import AiScenario, {
  AI_SCENARIO_COLLECTION,
} from '../../src/infrastructure/ai-scenario/ai-scenario.model.js';

/**
 * Schema-level checks of the AI01 models (no database: validateSync only).
 */
const CATEGORY = 'c00000000000000000000001';
const ITEM = 'c00000000000000000000002';
const PIZZA = 'c00000000000000000000003';
const SIZE = 'c00000000000000000000004';

const product = (aggregate) =>
  new Products({
    name: 'Dough',
    description: 'd',
    sellable: false,
    stockControlled: true,
    categoryId: CATEGORY,
    ...(aggregate !== undefined && { aggregate }),
  });

test('Product: aggregate is null by default', () => {
  const doc = product();
  assert.equal(doc.aggregate, null);
  assert.equal(doc.validateSync(), undefined);
});

test('Product: accepts a produced aggregate and a purchased one without items', () => {
  const producedDoc = product({
    classification: 'PRODUCED',
    items: [{ productId: ITEM, quantity: 2 }],
  });
  assert.equal(producedDoc.validateSync(), undefined);
  assert.equal(producedDoc.aggregate.items[0].quantity, 2);

  const purchased = product({ classification: 'PURCHASED' });
  assert.equal(purchased.validateSync(), undefined);
  assert.deepEqual(purchased.aggregate.items.toObject(), []);
});

test('Product: rejects an unknown classification and invalid item quantities', () => {
  const badClassification = product({ classification: 'OTHER', items: [] }).validateSync();
  assert.ok(badClassification?.errors['aggregate.classification']);

  for (const quantity of [0, 1.5]) {
    const error = product({
      classification: 'PRODUCED',
      items: [{ productId: ITEM, quantity }],
    }).validateSync();
    assert.ok(error?.errors['aggregate.items.0.quantity'], `quantity ${quantity}`);
  }
});

test('AiScenario: uses the collection created by the ai01 migration', () => {
  assert.equal(AiScenario.collection.collectionName, AI_SCENARIO_COLLECTION);
});

test('AiScenario: a valid scenario has simulated=true and no stock by default', () => {
  const doc = new AiScenario({
    code: 'DEMO-X',
    name: 'Demo',
    version: 1,
    orders: [{ pizzaId: PIZZA, sizeId: SIZE, quantity: 1 }],
  });
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.simulated, true);
  assert.equal(doc.stock, null);
});

test('AiScenario: stock lines have productId and quantity >= 0', () => {
  const ok = new AiScenario({
    code: 'DEMO-X',
    name: 'Demo',
    version: 1,
    orders: [{ pizzaId: PIZZA, sizeId: SIZE, quantity: 1 }],
    stock: [{ productId: ITEM, quantity: 0 }],
  });
  assert.equal(ok.validateSync(), undefined);

  const negative = new AiScenario({
    code: 'DEMO-X',
    name: 'Demo',
    version: 1,
    stock: [{ productId: ITEM, quantity: -1 }],
  }).validateSync();
  assert.ok(negative?.errors['stock.0.quantity']);
});

test('AiScenario: rejects an invalid code and version', () => {
  const error = new AiScenario({ code: 'demo x', name: 'Demo', version: 0 }).validateSync();
  assert.ok(error?.errors.code);
  assert.ok(error?.errors.version);
});
