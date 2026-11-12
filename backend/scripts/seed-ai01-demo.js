/**
 * AI01 demo seed: [Demo] catalogue, live stock and the BOM scenarios.
 *
 *   npm run seed:ai01-demo -- --confirm
 *
 * - Uses production dependencies only (runs on the VM after `npm prune --omit=dev`).
 * - Idempotent: upsert by fixed _id; running it again restores the demo values.
 * - Only touches the documents listed in seed/ai01-demo.json (fixed _id and "[Demo]" names).
 * - Validates everything with the domain functions before writing.
 */
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDB } from '../src/infrastructure/database.js';
import PizzaSize from '../src/infrastructure/pizza-size/pizza-size.model.js';
import ProductCategory, {
  NAME_COLLATION as CATEGORY_NAME_COLLATION,
} from '../src/infrastructure/product-categories/product-categories.model.js';
import PizzaComponentType from '../src/infrastructure/pizza-component-type/pizza-component-type.model.js';
import Products from '../src/infrastructure/products/products.model.js';
import PredefinedPizza from '../src/infrastructure/predefined-pizza/predefined-pizza.model.js';
import Stock from '../src/infrastructure/stock/stock.model.js';
import AiScenario from '../src/infrastructure/ai-scenario/ai-scenario.model.js';
import {
  validateProductName,
  validateProductDescription,
  normalizeAggregate,
  validateAggregateShape,
  validateAggregateItems,
  validateAggregateOwner,
} from '../src/domain/products/products.domain.js';
import {
  validateProductIsPizzaComponent,
  validateStockUnitsConsumed,
  validatePrice,
} from '../src/domain/component-size-configuration/component-size-configuration.domain.js';
import {
  validatePizzaProduct,
  validateSizeIds,
  validateComponentIds,
  validatePredefinedPizza,
} from '../src/domain/predefined-pizza/predefined-pizza.domain.js';
import { validateStockQuantity } from '../src/domain/stock/stock.domain.js';
import { validateScenario } from '../src/domain/ai-scenario/ai-scenario.domain.js';
import { pathToFileURL } from 'node:url';

const DEMO_PREFIX = '[Demo] ';
const DATABASE_NAME = 'laprizza'; // the same as connectDB (src/infrastructure/database.js)
const SEED_FILE = new URL('../seed/ai01-demo.json', import.meta.url);

export class SeedError extends Error {}

const fail = (message) => {
  throw new SeedError(message);
};

export async function loadSeedData() {
  return JSON.parse(await readFile(SEED_FILE, 'utf8'));
}

/** Removes credentials and options from the connection string. */
function describeTarget(uri) {
  const redacted = uri.replace(/\/\/[^@/]+@/, '//***@').split('?')[0];
  return `${redacted} (base de dados: ${DATABASE_NAME})`;
}

// ---------------------------------------------------------------------------------------------
// 1. Validation in memory (no database access)
// ---------------------------------------------------------------------------------------------

export function validateSeedData(data) {
  const ids = new Set();
  const checkId = (id, where) => {
    if (!mongoose.isValidObjectId(id)) fail(`${where}: _id inválido (${id}).`);
    if (ids.has(id)) fail(`${where}: _id repetido (${id}).`);
    ids.add(id);
  };
  const checkDemoName = (name, where) => {
    if (typeof name !== 'string' || !name.startsWith(DEMO_PREFIX)) {
      fail(`${where}: o nome tem de começar por "${DEMO_PREFIX}" (${name}).`);
    }
  };

  for (const s of data.sizes) {
    checkId(s._id, 'Tamanho');
    checkDemoName(s.name, 'Tamanho');
  }
  for (const c of data.categories) {
    checkId(c._id, 'Categoria');
    checkDemoName(c.name, 'Categoria');
  }

  const sizeIds = new Set(data.sizes.map((s) => s._id));
  const categoryIds = new Set(data.categories.map((c) => c._id));
  const productsById = new Map(data.products.map((p) => [p._id, p]));
  const pizzaProductIds = data.predefinedPizzas.map((p) => p.productId);

  for (const p of data.products) {
    const where = `Produto ${p.name}`;
    checkId(p._id, 'Produto');
    checkDemoName(p.name, 'Produto');
    validateProductName(p.name);
    validateProductDescription(p.description);
    if (p.sellable) validatePrice(p.price);
    if (!categoryIds.has(p.categoryId)) fail(`${where}: categoria desconhecida.`);

    for (const cfg of p.sizeConfigurations) {
      validateProductIsPizzaComponent({ pizzaComponentTypeId: p.componentType });
      if (!sizeIds.has(cfg.pizzaSizeId)) fail(`${where}: tamanho desconhecido.`);
      validatePrice(cfg.price);
      validateStockUnitsConsumed(p.stockControlled, cfg.stockUnitsConsumed);
    }

    const aggregate = normalizeAggregate(p.aggregate);
    if (aggregate) {
      validateAggregateShape(p._id, aggregate);
      validateAggregateOwner({
        isPizza: pizzaProductIds.includes(p._id),
        isItemOfAggregate: data.products.some((o) =>
          o.aggregate?.items?.some((i) => i.productId === p._id),
        ),
      });
      const itemInfos = aggregate.items
        .map((i) => productsById.get(i.productId))
        .filter(Boolean)
        .map((i) => ({
          id: i._id,
          name: i.name,
          isActive: true,
          isAggregate: i.aggregate != null,
        }));
      validateAggregateItems(aggregate.items, itemInfos, pizzaProductIds);
    }
  }

  for (const pizza of data.predefinedPizzas) {
    checkId(pizza._id, 'Pizza predefinida');
    const product = productsById.get(pizza.productId);
    if (!product) fail(`Pizza predefinida ${pizza._id}: produto desconhecido.`);
    validatePizzaProduct({
      isActive: true,
      sellable: product.sellable,
      componentTypeId: product.componentType,
    });
    validateSizeIds(pizza.sizeIds);
    validateComponentIds(pizza.componentIds);
  }

  const stockIds = new Set();
  for (const s of data.stock) {
    const product = productsById.get(s.productId);
    if (!product) fail(`Stock: produto desconhecido (${s.productId}).`);
    if (!product.stockControlled) fail(`Stock: ${product.name} não tem controlo de stock.`);
    if (stockIds.has(s.productId)) fail(`Stock: ${product.name} repetido.`);
    stockIds.add(s.productId);
    validateStockQuantity(s.quantity);
  }

  const pizzas = data.predefinedPizzas.map((p) => ({ productId: p.productId, sizeIds: p.sizeIds }));
  const stockProducts = data.products.map((p) => ({
    id: p._id,
    stockControlled: p.stockControlled,
  }));
  for (const sc of data.scenarios) {
    checkId(sc._id, 'Cenário');
    checkDemoName(sc.name, 'Cenário');
    validateScenario(sc, { pizzas, stockProducts });
  }
}

// ---------------------------------------------------------------------------------------------
// 2. Validation against the database (still before writing)
// ---------------------------------------------------------------------------------------------

/** Resolves the component types by name and validates the pizzas with the real types. */
async function resolveComponentTypes(data) {
  const types = await PizzaComponentType.find({ isActive: { $ne: false } }).lean();
  const typeByName = new Map(types.map((t) => [t.name.toLowerCase(), t]));

  const typeIdByProduct = new Map();
  for (const p of data.products) {
    if (!p.componentType) continue;
    const type = typeByName.get(p.componentType.toLowerCase());
    if (!type) {
      fail(
        `Tipo de componente "${p.componentType}" não existe ou está inativo (usado por ${p.name}).`,
      );
    }
    typeIdByProduct.set(p._id, String(type._id));
  }

  const componentTypes = types.map((t) => ({
    id: String(t._id),
    name: t.name,
    assemblyOrder: t.assemblyOrder,
    minQuantity: t.minQuantity ?? 0,
    maxQuantity: t.maxQuantity ?? null,
  }));
  const sizes = data.sizes.map((s) => ({ id: s._id, name: s.name, isActive: true }));
  const components = data.products.map((p) => ({
    id: p._id,
    name: p.name,
    isActive: true,
    componentTypeId: typeIdByProduct.get(p._id) ?? null,
    configuredSizeIds: p.sizeConfigurations.map((c) => c.pizzaSizeId),
  }));

  for (const pizza of data.predefinedPizzas) {
    validatePredefinedPizza({
      sizeIds: pizza.sizeIds,
      componentIds: pizza.componentIds,
      sizes,
      components,
      componentTypes,
    });
  }
  return typeIdByProduct;
}

/**
 * Makes sure the seed never overwrites data that is not its own:
 * the fixed _id must be free or already hold the same "[Demo]" document,
 * and the unique names/codes must not belong to another document.
 */
async function checkOwnership(data) {
  const checks = [
    { model: PizzaSize, docs: data.sizes, key: 'name', label: 'Tamanho' },
    {
      model: ProductCategory,
      docs: data.categories,
      key: 'name',
      label: 'Categoria',
      collation: CATEGORY_NAME_COLLATION,
    },
    { model: Products, docs: data.products, key: 'name', label: 'Produto' },
    { model: AiScenario, docs: data.scenarios, key: 'code', label: 'Cenário' },
  ];

  for (const { model, docs, key, label, collation } of checks) {
    for (const doc of docs) {
      const existing = await model.findById(doc._id).lean();
      if (existing && !String(existing.name ?? '').startsWith(DEMO_PREFIX)) {
        fail(`${label} ${doc._id} já existe e não é de demonstração ("${existing.name}").`);
      }
      let query = model.findOne({ [key]: doc[key], _id: { $ne: doc._id } });
      if (collation) query = query.collation(collation);
      const clash = await query.lean();
      if (clash) fail(`${label} "${doc[key]}" já existe com outro _id (${clash._id}).`);
    }
  }

  for (const pizza of data.predefinedPizzas) {
    const clash = await PredefinedPizza.findOne({
      productId: pizza.productId,
      _id: { $ne: pizza._id },
    }).lean();
    if (clash) fail(`Já existe outra pizza predefinida para o produto ${pizza.productId}.`);
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Writing (upsert by _id)
// ---------------------------------------------------------------------------------------------

const upsert = (model, id, fields) =>
  model.updateOne({ _id: id }, { $set: fields }, { upsert: true, runValidators: true });

function count(summary, label, result) {
  const entry = (summary[label] ??= { criados: 0, repostos: 0 });
  if (result.upsertedCount) entry.criados += 1;
  else entry.repostos += 1;
}

async function writeSeed(data, typeIdByProduct) {
  const summary = {};

  for (const s of data.sizes) {
    count(summary, 'tamanhos', await upsert(PizzaSize, s._id, { name: s.name, isActive: true }));
  }
  for (const c of data.categories) {
    count(
      summary,
      'categorias',
      await upsert(ProductCategory, c._id, { name: c.name, isActive: true }),
    );
  }
  for (const p of data.products) {
    const result = await upsert(Products, p._id, {
      name: p.name,
      description: p.description,
      price: p.price,
      sellable: p.sellable,
      stockControlled: p.stockControlled,
      categoryId: p.categoryId,
      pizzaComponentTypeId: typeIdByProduct.get(p._id) ?? null,
      allergenIds: [],
      sizeConfigurations: p.sizeConfigurations,
      aggregate: normalizeAggregate(p.aggregate),
      isActive: true,
    });
    count(summary, 'produtos', result);
  }
  for (const pizza of data.predefinedPizzas) {
    const result = await upsert(PredefinedPizza, pizza._id, {
      productId: pizza.productId,
      sizeIds: pizza.sizeIds,
      defaultConfiguration: { componentIds: pizza.componentIds },
      isActive: true,
    });
    count(summary, 'pizzas predefinidas', result);
  }

  for (const s of data.stock) {
    const result = await Stock.updateOne(
      { productId: s.productId },
      { $set: { quantity: s.quantity } },
      { upsert: true, runValidators: true },
    );
    count(summary, 'stock', result);
  }
  // Demo products without stock control must not have a stock record.
  const notControlled = data.products.filter((p) => !p.stockControlled).map((p) => p._id);
  await Stock.deleteMany({ productId: { $in: notControlled } });

  for (const sc of data.scenarios) {
    const result = await upsert(AiScenario, sc._id, {
      code: sc.code,
      name: sc.name,
      description: sc.description ?? '',
      version: sc.version,
      simulated: true,
      orders: sc.orders,
      stock: sc.stock ?? null,
      isActive: true,
    });
    count(summary, 'cenários', result);
  }
  return summary;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('MONGODB_URI não está definido (carrega o .env antes de correr o seed).');

  console.log(`Destino: ${describeTarget(uri)}`);
  if (!process.argv.includes('--confirm')) {
    console.log('Nada foi escrito. Para continuar: npm run seed:ai01-demo -- --confirm');
    process.exitCode = 1;
    return;
  }

  const data = await loadSeedData();
  validateSeedData(data);

  await connectDB(uri);
  try {
    const typeIdByProduct = await resolveComponentTypes(data);
    await checkOwnership(data);
    const summary = await writeSeed(data, typeIdByProduct);
    console.log('Seed AI01 concluído:');
    console.table(summary);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    const code = err.code ? ` [${err.code}]` : '';
    console.error(`Seed AI01 falhou${code}: ${err.message}`);
    process.exitCode = 1;
  });
}
