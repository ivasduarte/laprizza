import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import Products from '../../src/infrastructure/products/products.model.js';
import PredefinedPizza from '../../src/infrastructure/predefined-pizza/predefined-pizza.model.js';
import PizzaSize from '../../src/infrastructure/pizza-size/pizza-size.model.js';
import ProductCategory from '../../src/infrastructure/product-categories/product-categories.model.js';
import Stock from '../../src/infrastructure/stock/stock.model.js';
import AiScenario, {
  AI_SCENARIO_COLLECTION,
} from '../../src/infrastructure/ai-scenario/ai-scenario.model.js';
import * as productsRepository from '../../src/infrastructure/products/products.repository.js';
import * as predefinedPizzaRepository from '../../src/infrastructure/predefined-pizza/predefined-pizza.repository.js';
import * as aiScenarioRepository from '../../src/infrastructure/ai-scenario/ai-scenario.repository.js';
import Forecast from '../../src/infrastructure/forecast/forecast.model.js';
import SupplierScenario from '../../src/infrastructure/supplier-scenario/supplier-scenario.model.js';
import { createAiDataRepository } from '../../src/infrastructure/ai-data/ai-data.repository.js';
import { getSnapshot } from '../../src/application/ai-data/ai-data.service.js';
import { seedInitialPizzaComponentTypes } from '../../src/infrastructure/seeder.js';
import { up, down } from '../../migrations/ai01-bom-aggregates-and-scenarios.js';
import { startMongo, STARTUP_TIMEOUT_MS } from '../support/mongo-container.js';

/**
 * Integration tests of AI01 against a real MongoDB (Testcontainers):
 * the migration, the new repository queries and the demo seed.
 */
const execFileAsync = promisify(execFile);
const BACKEND_DIR = fileURLToPath(new URL('../../', import.meta.url));
const SEED_SCRIPT = 'scripts/seed-ai01-demo.js';

const CATEGORY = 'c00000000000000000000001';
const SIZE = 'c00000000000000000000002';
const OTHER_SIZE = 'c00000000000000000000003';

let mongo;

before(
  async () => {
    mongo = await startMongo();
    await seedInitialPizzaComponentTypes();
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

after(async () => {
  await mongo?.stop();
});

beforeEach(async () => {
  await Promise.all([
    Products.deleteMany({}),
    PredefinedPizza.deleteMany({}),
    PizzaSize.deleteMany({}),
    ProductCategory.deleteMany({}),
    Stock.deleteMany({}),
    AiScenario.deleteMany({}),
  ]);
});

const createProduct = (name, extra = {}) =>
  Products.create({
    name,
    description: name,
    sellable: false,
    stockControlled: false,
    categoryId: CATEGORY,
    ...extra,
  });

/** Runs the seed in a child process, as `npm run seed:ai01-demo` does. */
const runSeed = (...args) =>
  execFileAsync(process.execPath, [SEED_SCRIPT, ...args], {
    cwd: BACKEND_DIR,
    env: { ...process.env, MONGODB_URI: mongo.uri },
  });

// ---------------------------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------------------------

test('migration: creates the scenarios collection with a unique index on code', async () => {
  const indexes = await mongoose.connection.db.collection(AI_SCENARIO_COLLECTION).indexes();
  const codeIndex = indexes.find((i) => i.name === 'code_1');
  assert.ok(codeIndex, 'code_1 index');
  assert.equal(codeIndex.unique, true);
});

test('migration: up sets aggregate null on old products and can run again', async () => {
  const products = mongoose.connection.db.collection('products');
  await products.insertOne({ name: 'Old product', categoryId: CATEGORY });

  await up(mongoose.connection.db);
  await up(mongoose.connection.db); // idempotent

  const old = await products.findOne({ name: 'Old product' });
  assert.equal(old.aggregate, null);
});

test('migration: down removes the collection and the field, up restores them', async () => {
  const db = mongoose.connection.db;
  await db.collection('products').insertOne({ name: 'P', categoryId: CATEGORY, aggregate: null });

  await down(db);
  assert.equal(await db.listCollections({ name: AI_SCENARIO_COLLECTION }).hasNext(), false);
  assert.equal((await db.collection('products').findOne({ name: 'P' })).aggregate, undefined);

  await up(db);
  assert.equal(await db.listCollections({ name: AI_SCENARIO_COLLECTION }).hasNext(), true);
  assert.equal((await db.collection('products').findOne({ name: 'P' })).aggregate, null);
});

// ---------------------------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------------------------

test('products repository: aggregate info and items of aggregates', async () => {
  const flour = await createProduct('Flour');
  const inactive = await createProduct('Old', { isActive: false });
  const dough = await createProduct('Dough', {
    aggregate: { classification: 'PRODUCED', items: [{ productId: flour._id, quantity: 2 }] },
  });

  const infos = await productsRepository.findAggregateInfoByIds([
    String(flour._id),
    String(dough._id),
    String(inactive._id),
    'not-an-id',
  ]);
  const byId = Object.fromEntries(infos.map((i) => [i.id, i]));
  assert.equal(infos.length, 3);
  assert.equal(byId[flour._id].isAggregate, false);
  assert.equal(byId[dough._id].isAggregate, true);
  assert.equal(byId[inactive._id].isActive, false);

  assert.equal(await productsRepository.existsAggregateWithItem(String(flour._id)), true);
  assert.equal(await productsRepository.existsAggregateWithItem(String(dough._id)), false);
  assert.equal(await productsRepository.existsAggregateWithItem('not-an-id'), false);
});

test('products repository: an item of an inactive aggregate still counts (no nesting on reactivation)', async () => {
  const flour = await createProduct('Flour');
  await createProduct('Dough', {
    isActive: false,
    aggregate: { classification: 'PRODUCED', items: [{ productId: flour._id, quantity: 1 }] },
  });

  assert.equal(await productsRepository.existsAggregateWithItem(String(flour._id)), true);
});

test('predefined pizza repository: only active predefined pizzas, with their sizes', async () => {
  const pizza = await createProduct('Margherita', { sellable: true, price: 8 });
  const oldPizza = await createProduct('Old pizza', { sellable: true, price: 8 });
  const flour = await createProduct('Flour');
  await PredefinedPizza.create({ productId: pizza._id, sizeIds: [SIZE, OTHER_SIZE] });
  await PredefinedPizza.create({ productId: oldPizza._id, sizeIds: [SIZE], isActive: false });

  const ids = [String(pizza._id), String(oldPizza._id), String(flour._id), 'not-an-id'];
  assert.deepEqual(await predefinedPizzaRepository.findPizzaProductIds(ids), [String(pizza._id)]);
  assert.deepEqual(await predefinedPizzaRepository.findActiveByProductIds(ids), [
    { productId: String(pizza._id), sizeIds: [SIZE, OTHER_SIZE] },
  ]);
});

test('scenario repository: finds active scenarios by code and the code is unique', async () => {
  const base = { name: '[Demo] X', version: 1, orders: [] };
  await AiScenario.create({ ...base, code: 'DEMO-A' });
  await AiScenario.create({ ...base, code: 'DEMO-OLD', isActive: false });

  assert.equal((await aiScenarioRepository.findActiveByCode('DEMO-A')).code, 'DEMO-A');
  assert.equal(await aiScenarioRepository.findActiveByCode('DEMO-OLD'), null);
  assert.equal(await aiScenarioRepository.findActiveByCode('DEMO-NONE'), null);

  await assert.rejects(AiScenario.create({ ...base, code: 'DEMO-A' }), (err) => err.code === 11000);
});

// ---------------------------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------------------------

const countDemo = async () => ({
  sizes: await PizzaSize.countDocuments({ name: /^\[Demo\] / }),
  categories: await ProductCategory.countDocuments({ name: /^\[Demo\] / }),
  products: await Products.countDocuments({ name: /^\[Demo\] / }),
  pizzas: await PredefinedPizza.countDocuments({}),
  stock: await Stock.countDocuments({}),
  scenarios: await AiScenario.countDocuments({}),
});

const EXPECTED = { sizes: 3, categories: 2, products: 13, pizzas: 3, stock: 6, scenarios: 4 };

test('seed: refuses to write without --confirm', async () => {
  await assert.rejects(runSeed(), (err) => err.code === 1);
  assert.deepEqual(await countDemo(), {
    sizes: 0,
    categories: 0,
    products: 0,
    pizzas: 0,
    stock: 0,
    scenarios: 0,
  });
});

test('seed: writes the demo data and is idempotent', { timeout: 60_000 }, async () => {
  await runSeed('--confirm');
  assert.deepEqual(await countDemo(), EXPECTED);

  // Changes made by hand are restored by the next run, without duplicates.
  await Stock.updateOne({ productId: 'de01b0000000000000000003' }, { quantity: 99 });
  await runSeed('--confirm');
  assert.deepEqual(await countDemo(), EXPECTED);
  assert.equal((await Stock.findOne({ productId: 'de01b0000000000000000003' })).quantity, 5);

  const dough = await Products.findById('de01b0000000000000000001').lean();
  assert.equal(dough.aggregate.classification, 'PRODUCED');
  assert.equal(dough.aggregate.items.length, 3);
  const scenario = await aiScenarioRepository.findActiveByCode('DEMO-PARTIAL');
  assert.equal(scenario.orders[0].quantity, 3);
  assert.equal(scenario.stock.length, 3);
});

test('seed: never overwrites a document that is not a demo document', async () => {
  await createProduct('Real dough', { _id: 'de01b0000000000000000001' });

  await assert.rejects(runSeed('--confirm'), (err) => err.code === 1);
  assert.equal((await Products.findById('de01b0000000000000000001')).name, 'Real dough');
  assert.equal(await AiScenario.countDocuments({}), 0);
});

// ---------------------------------------------------------------------------------------------
// Snapshot of a BOM scenario, from the seed, against the fixture used by the Prolog tests
// ---------------------------------------------------------------------------------------------

const FIXTURE = JSON.parse(
  readFileSync(new URL('../../../ai-scheduling/fixtures/demo-partial.json', import.meta.url), 'utf8'),
);
const SEED = JSON.parse(readFileSync(new URL('../../seed/ai01-demo.json', import.meta.url), 'utf8'));

const aiDataRepository = createAiDataRepository({
  productModel: Products,
  sizeModel: PizzaSize,
  predefinedPizzaModel: PredefinedPizza,
  stockModel: Stock,
  forecastModel: Forecast,
  supplierScenarioModel: SupplierScenario,
  aiScenarioRepository,
});

/**
 * Replaces the ids of the seed by the readable ids of the fixture: products by name and sizes
 * by name without the "[Demo] " prefix.
 */
function toFixtureIds(value) {
  const ids = new Map();
  for (const p of SEED.products) {
    const f = FIXTURE.products.find((fp) => fp.name === p.name);
    if (f) ids.set(p._id, f.id);
  }
  for (const s of SEED.sizes) {
    const f = FIXTURE.sizes.find((fs) => fs.name === s.name.replace('[Demo] ', ''));
    if (f) ids.set(s._id, f.id);
  }
  const tr = (v) => {
    if (Array.isArray(v)) return v.map(tr);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tr(x)]));
    }
    return typeof v === 'string' && ids.has(v) ? ids.get(v) : v;
  };
  return tr(value);
}

const asSet = (list) => list.map((x) => JSON.stringify(x)).sort();
const sortedItems = (aggregates) =>
  aggregates.map((a) => ({ ...a, items: asSet(a.items) })).sort((a, b) => a.id.localeCompare(b.id));
const withoutTimes = (sources) =>
  Object.fromEntries(
    Object.entries(sources).map(([k, s]) => [
      k,
      Object.fromEntries(
        Object.entries(s).filter(([key]) => !['retrievedAt', 'version'].includes(key)),
      ),
    ]),
  );

test('snapshot: DEMO-PARTIAL from the seed matches the fixture of the Prolog tests', { timeout: 60_000 }, async () => {
  await runSeed('--confirm');
  const snap = toFixtureIds(
    await getSnapshot(aiDataRepository, () => new Date(), {
      scenarioId: 'DEMO-PARTIAL',
      stockMode: 'scenario',
    }),
  );

  // Ids, times and hashes are generated; everything else must be the same.
  assert.equal(snap.meta.source, FIXTURE.meta.source);
  assert.equal(snap.meta.simulated, FIXTURE.meta.simulated);
  assert.deepEqual(withoutTimes(snap.meta.sources), withoutTimes(FIXTURE.meta.sources));
  assert.deepEqual(snap.scenario, FIXTURE.scenario);
  assert.deepEqual(snap.orders, FIXTURE.orders);
  assert.deepEqual(asSet(snap.pizzas), asSet(FIXTURE.pizzas));
  assert.deepEqual(sortedItems(snap.aggregates), sortedItems(FIXTURE.aggregates));
  assert.deepEqual(asSet(snap.products), asSet(FIXTURE.products));
  assert.deepEqual(asSet(snap.sizes.map((s) => s.id)), asSet(FIXTURE.sizes.map((s) => s.id)));
  assert.deepEqual(asSet(snap.bom), asSet(FIXTURE.bom));
  assert.deepEqual(asSet(snap.stock), asSet(FIXTURE.stock));
  assert.deepEqual(asSet(snap.issues), asSet(FIXTURE.issues));
  assert.equal(snap.forecast, null);
  assert.equal(snap.supplierScenario, null);
});

test('snapshot: DEMO-PARTIAL in live mode uses the stock written by the seed', { timeout: 60_000 }, async () => {
  await runSeed('--confirm');
  const snap = await getSnapshot(aiDataRepository, () => new Date(), {
    scenarioId: 'DEMO-PARTIAL',
    stockMode: 'live',
  });

  const expected = SEED.stock
    .map((s) => ({ productId: s.productId, quantity: s.quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  assert.deepEqual(snap.stock, expected);
  assert.equal(snap.meta.sources.stock.source, 'backend-live');
});

test('snapshot: unknown scenario and scenario without stock', async () => {
  await runSeed('--confirm');
  await assert.rejects(
    getSnapshot(aiDataRepository, () => new Date(), {
      scenarioId: 'DEMO-NOPE',
      stockMode: 'scenario',
    }),
    (err) => err.status === 404 && err.code === 'AI_SCENARIO_NOT_FOUND',
  );

  await AiScenario.updateOne({ code: 'DEMO-PARTIAL' }, { stock: null });
  await assert.rejects(
    getSnapshot(aiDataRepository, () => new Date(), {
      scenarioId: 'DEMO-PARTIAL',
      stockMode: 'scenario',
    }),
    (err) => err.status === 400 && err.code === 'SCENARIO_WITHOUT_STOCK',
  );
});
