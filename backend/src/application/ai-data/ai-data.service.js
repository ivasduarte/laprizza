import { createHash } from 'node:crypto';
import { cached } from '../../infrastructure/cache/cache.js';
import { AppError } from '../app-error.js';

const cmp =
  (...keys) =>
  (a, b) => {
    for (const k of keys) {
      const c = String(a[k]).localeCompare(String(b[k]));
      if (c !== 0) return c;
    }
    return 0;
  };

const isUnits = (n) => Number.isInteger(n) && n >= 0;

const toDay = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/** Forecast as the Prolog knowledge base reads it: plain ids and "YYYY-MM-DD" dates, stable order. */
export function toSnapshotForecast(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id ?? doc.id),
    name: doc.name,
    version: doc.version,
    startDate: toDay(doc.startDate),
    endDate: toDay(doc.endDate),
    entries: (doc.entries ?? [])
      .map((e) => ({
        date: toDay(e.date),
        productId: String(e.productId),
        ...(e.sizeId ? { sizeId: String(e.sizeId) } : {}),
        quantity: e.quantity,
      }))
      .sort(cmp('date', 'productId', 'sizeId')),
  };
}

/** Supplier scenario as the Prolog knowledge base reads it (always simulated). */
export function toSnapshotSupplierScenario(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id ?? doc.id),
    name: doc.name,
    version: doc.version,
    simulated: doc.simulated !== false,
    suppliers: (doc.suppliers ?? []).map((s) => ({ id: s.id, name: s.name })).sort(cmp('id')),
    products: (doc.products ?? [])
      .map((p) => ({
        productId: String(p.productId),
        offers: (p.offers ?? [])
          .map((o) => ({
            supplierId: o.supplierId,
            priceEur: o.priceEur,
            stockUnits: o.stockUnits,
            leadTimeDays: o.leadTimeDays,
            ...(o.supplyLimit === undefined || o.supplyLimit === null
              ? {}
              : { supplyLimit: o.supplyLimit }),
          }))
          .sort(cmp('supplierId')),
      }))
      .sort(cmp('productId')),
  };
}

/** Origin and version of a planning input, recorded in meta.sources (AI06). */
const inputSource = (mapped, retrievedAt) =>
  mapped
    ? { source: 'backend', id: mapped.id, name: mapped.name, version: mapped.version, retrievedAt }
    : null;

const withSources = (sources, retrievedAt, forecast, supplierScenario) => ({
  ...sources,
  ...(forecast ? { forecast: inputSource(forecast, retrievedAt) } : {}),
  ...(supplierScenario ? { supplierScenario: inputSource(supplierScenario, retrievedAt) } : {}),
});

const STOCK_UNIT = 'abstract stock unit';

/**
 * Products to export as JSON for the supplier file (WEB07): raw materials, purchased aggregates
 * and directly sold stock-controlled products. Produced aggregates are made in-house, so they
 * are not bought. The selling price is optional and never excludes a product.
 */
export function buildProductsExport(products, now = new Date()) {
  const rows = [];
  for (const p of products) {
    const classification = p.aggregate?.classification;
    let kind = null;
    if (classification === 'PURCHASED') kind = 'purchasedAggregate';
    else if (classification === 'PRODUCED') kind = null;
    else if (p.stockControlled === true) kind = p.sellable === true ? 'directSale' : 'rawMaterial';
    if (!kind) continue;
    rows.push({
      id: String(p._id),
      name: p.name,
      kind,
      stockUnit: STOCK_UNIT,
      sellable: p.sellable === true,
      ...(p.sellable === true && typeof p.price === 'number' && p.price > 0
        ? { sellingPriceEur: p.price }
        : {}),
    });
  }
  return { exportedAt: now.toISOString(), products: rows.sort(cmp('name', 'id')) };
}

export async function getProductsExport(aiDataRepository, clock = () => new Date()) {
  return buildProductsExport(await aiDataRepository.listProducts(), clock());
}

export function toPlanningProduct(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    sellable: doc.sellable === true,
    stockControlled: doc.stockControlled === true,
    isPizzaComponent: doc.pizzaComponentTypeId != null,
  };
}

export function toPlanningSize(doc) {
  return { id: String(doc._id), name: doc.name };
}

export function buildBom(pizzas, productsById, { reportUnmeasured = false } = {}) {
  const bom = [];
  const issues = [];
  for (const pizza of pizzas) {
    const pizzaId = String(pizza.productId);
    const componentIds = (pizza.defaultConfiguration?.componentIds ?? []).map(String);
    for (const sizeId of (pizza.sizeIds ?? []).map(String)) {
      for (const componentId of componentIds) {
        const component = productsById.get(componentId);
        if (!component) {
          issues.push({ code: 'UNKNOWN_COMPONENT', pizzaId, sizeId, componentId });
          continue;
        }
        const cfg = (component.sizeConfigurations ?? []).find(
          (c) => String(c.pizzaSizeId) === sizeId,
        );
        const quantity = cfg?.stockUnitsConsumed;
        if (component.stockControlled !== true) {
          if (!reportUnmeasured) continue;
          if (isUnits(quantity) && quantity > 0) {
            bom.push({ pizzaId, sizeId, componentId, quantity });
          } else {
            issues.push({ code: 'UNMEASURED_NON_STOCK_COMPONENT', pizzaId, sizeId, componentId });
          }
          continue;
        }
        if (!isUnits(quantity)) {
          issues.push({ code: 'MISSING_OR_INVALID_STOCK_UNITS', pizzaId, sizeId, componentId });
          continue;
        }
        bom.push({ pizzaId, sizeId, componentId, quantity });
      }
    }
  }
  return { bom, issues };
}

export function buildSnapshot(
  { products, sizes, pizzas, stock, forecast, scenario },
  now = new Date(),
) {
  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const { bom, issues } = buildBom(pizzas, productsById);

  const stockEntries = [];
  for (const s of stock) {
    const productId = String(s.productId);
    const product = productsById.get(productId);
    if (!product) {
      issues.push({ code: 'STOCK_UNKNOWN_PRODUCT', productId });
    } else if (product.stockControlled !== true) {
      issues.push({ code: 'STOCK_NOT_CONTROLLED', productId });
    } else if (!isUnits(s.quantity)) {
      issues.push({ code: 'STOCK_INVALID_QUANTITY', productId });
    } else {
      stockEntries.push({ productId, quantity: s.quantity });
    }
  }

  const content = {
    products: products.map(toPlanningProduct).sort(cmp('id')),
    sizes: sizes.map(toPlanningSize).sort(cmp('id')),
    bom: bom.sort(cmp('pizzaId', 'sizeId', 'componentId')),
    aggregates: [],
    stock: stockEntries.sort(cmp('productId')),
  };

  const snapshotId = createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex')
    .slice(0, 16);

  const mappedForecast = toSnapshotForecast(forecast);
  const mappedScenario = toSnapshotSupplierScenario(scenario);
  const retrievedAt = now.toISOString();
  const sources = withSources({}, retrievedAt, mappedForecast, mappedScenario);

  return {
    meta: {
      snapshotId,
      retrievedAt,
      source: 'backend',
      simulated: false,
      ...(Object.keys(sources).length > 0 ? { sources } : {}),
    },
    ...content,
    forecast: mappedForecast,
    supplierScenario: mappedScenario,
    issues,
  };
}

const AGGREGATE_CLASSIFICATION = { PRODUCED: 'production', PURCHASED: 'purchase' };
const hashOf = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export function buildAggregates(products) {
  return products
    .filter((p) => p.aggregate?.classification)
    .map((p) => ({
      id: String(p._id),
      classification:
        AGGREGATE_CLASSIFICATION[p.aggregate.classification] ??
        String(p.aggregate.classification).toLowerCase(),
      items: (p.aggregate.items ?? [])
        .map((item) => ({ componentId: String(item.productId), quantity: item.quantity }))
        .sort(cmp('componentId')),
    }))
    .sort(cmp('id'));
}

export function buildPizzas(pizzas) {
  return pizzas
    .map((p) => ({ id: String(p.productId), sizeIds: (p.sizeIds ?? []).map(String) }))
    .sort(cmp('id'));
}

export function buildLiveStock(products, stock, productsById, issues) {
  const quantities = new Map();
  for (const s of stock) {
    const productId = String(s.productId);
    const product = productsById.get(productId);
    if (!product) {
      issues.push({ code: 'STOCK_UNKNOWN_PRODUCT', productId });
    } else if (product.stockControlled !== true) {
      issues.push({ code: 'STOCK_NOT_CONTROLLED', productId });
    } else if (!isUnits(s.quantity)) {
      issues.push({ code: 'STOCK_INVALID_QUANTITY', productId });
    } else {
      quantities.set(productId, s.quantity);
    }
  }
  return products
    .filter((p) => p.stockControlled === true)
    .map((p) => ({ productId: String(p._id), quantity: quantities.get(String(p._id)) ?? 0 }))
    .sort(cmp('productId'));
}

/** Stock of the scenario, exactly as stored (missing products are detected by the AI service). */
export function buildScenarioStock(scenario) {
  return scenario.stock
    .map((s) => ({ productId: String(s.productId), quantity: s.quantity }))
    .sort(cmp('productId'));
}

export function buildScenarioSnapshot(
  { products, sizes, pizzas, stock, scenario, forecast = null, supplierScenario = null },
  stockMode,
  now = new Date(),
) {
  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const { bom, issues } = buildBom(pizzas, productsById, { reportUnmeasured: true });
  const retrievedAt = now.toISOString();

  const catalogue = {
    products: products.map(toPlanningProduct).sort(cmp('id')),
    sizes: sizes.map(toPlanningSize).sort(cmp('id')),
    bom: bom.sort(cmp('pizzaId', 'sizeId', 'componentId')),
    aggregates: buildAggregates(products),
    pizzas: buildPizzas(pizzas),
  };
  const stockEntries =
    stockMode === 'live'
      ? buildLiveStock(products, stock, productsById, issues)
      : buildScenarioStock(scenario);
  const scenarioInfo = {
    id: scenario.code,
    name: scenario.name,
    version: scenario.version,
    simulated: true,
    stockMode,
  };
  const orders = [
    {
      id: `${scenario.code}#1`,
      simulated: true,
      items: (scenario.orders ?? []).map((o) => ({
        pizzaId: String(o.pizzaId),
        sizeId: String(o.sizeId),
        quantity: o.quantity,
      })),
    },
  ];

  const mappedForecast = toSnapshotForecast(forecast);
  const mappedSupplierScenario = toSnapshotSupplierScenario(supplierScenario);
  const content = {
    ...catalogue,
    stock: stockEntries,
    scenario: scenarioInfo,
    orders,
    forecast: mappedForecast,
    supplierScenario: mappedSupplierScenario,
  };
  const fromScenario = {
    source: 'scenario',
    scenarioId: scenario.code,
    scenarioVersion: scenario.version,
    retrievedAt,
  };

  return {
    meta: {
      snapshotId: hashOf(content),
      retrievedAt,
      source: 'backend',
      simulated: true,
      sources: withSources(
        {
          catalogue: { source: 'backend', retrievedAt, version: hashOf(catalogue) },
          stock: stockMode === 'live' ? { source: 'backend-live', retrievedAt } : fromScenario,
          orders: fromScenario,
        },
        retrievedAt,
        mappedForecast,
        mappedSupplierScenario,
      ),
    },
    scenario: scenarioInfo,
    ...catalogue,
    stock: stockEntries,
    orders,
    forecast: mappedForecast,
    supplierScenario: mappedSupplierScenario,
    issues,
  };
}

async function loadForecast(aiDataRepository, forecastId) {
  if (!forecastId) return aiDataRepository.getActiveForecast();
  const forecast = await aiDataRepository.findForecastById(forecastId);
  if (!forecast) throw new AppError('Forecast not found.', 404, null, 'FORECAST_NOT_FOUND');
  return forecast;
}

async function loadSupplierScenario(aiDataRepository, supplierScenarioId) {
  if (!supplierScenarioId) return aiDataRepository.getActiveSupplierScenario();
  const scenario = await aiDataRepository.findSupplierScenarioById(supplierScenarioId);
  if (!scenario) {
    throw new AppError('Supplier scenario not found.', 404, null, 'SUPPLIER_SCENARIO_NOT_FOUND');
  }
  return scenario;
}

async function getScenarioSnapshot(
  aiDataRepository,
  clock,
  { scenarioId, stockMode, forecastId, supplierScenarioId },
) {
  const scenario = await aiDataRepository.findActiveScenarioByCode(scenarioId);
  if (!scenario) {
    throw new AppError('AI scenario not found.', 404, null, 'AI_SCENARIO_NOT_FOUND');
  }
  if (stockMode === 'scenario' && !Array.isArray(scenario.stock)) {
    throw new AppError(
      'The scenario has no stock of its own; use stockMode=live.',
      400,
      null,
      'SCENARIO_WITHOUT_STOCK',
    );
  }
  const [products, sizes, pizzas, stock, forecast, supplierScenario] = await Promise.all([
    aiDataRepository.listProducts(),
    aiDataRepository.listSizes(),
    aiDataRepository.listPredefinedPizzas(),
    stockMode === 'live' ? aiDataRepository.listStock() : [],
    loadForecast(aiDataRepository, forecastId),
    loadSupplierScenario(aiDataRepository, supplierScenarioId),
  ]);
  return buildScenarioSnapshot(
    { products, sizes, pizzas, stock, scenario, forecast, supplierScenario },
    stockMode,
    clock(),
  );
}

export async function getSnapshot(aiDataRepository, clock = () => new Date(), params = {}) {
  if (params.scenarioId) return getScenarioSnapshot(aiDataRepository, clock, params);

  const { forecastId, supplierScenarioId } = params;
  const cacheKey =
    forecastId || supplierScenarioId
      ? ['snapshot', forecastId ?? '', supplierScenarioId ?? '']
      : ['snapshot'];

  return cached('ai-data', cacheKey, 60, async () => {
    const [products, sizes, pizzas, stock, forecast, scenario] = await Promise.all([
      aiDataRepository.listProducts(),
      aiDataRepository.listSizes(),
      aiDataRepository.listPredefinedPizzas(),
      aiDataRepository.listStock(),
      loadForecast(aiDataRepository, forecastId),
      loadSupplierScenario(aiDataRepository, supplierScenarioId),
    ]);
    return buildSnapshot({ products, sizes, pizzas, stock, forecast, scenario }, clock());
  });
}
