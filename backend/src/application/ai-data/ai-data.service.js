import { createHash } from 'node:crypto';
import { cached } from '../../infrastructure/cache/cache.js';

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

export function buildBom(pizzas, productsById) {
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
        if (component.stockControlled !== true) continue;
        const cfg = (component.sizeConfigurations ?? []).find(
          (c) => String(c.pizzaSizeId) === sizeId,
        );
        const quantity = cfg?.stockUnitsConsumed;
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

  const mappedForecast = forecast
    ? { id: String(forecast._id), ...forecast, _id: undefined }
    : null;
  const mappedScenario = scenario
    ? { id: String(scenario._id), ...scenario, _id: undefined }
    : null;

  return {
    meta: { snapshotId, retrievedAt: now.toISOString(), source: 'backend', simulated: false },
    ...content,
    forecast: mappedForecast,
    supplierScenario: mappedScenario,
    issues,
  };
}

export async function getSnapshot(aiDataRepository, clock = () => new Date()) {
  return cached('ai-data', ['snapshot'], 60, async () => {
    const [products, sizes, pizzas, stock, forecast, scenario] = await Promise.all([
      aiDataRepository.listProducts(),
      aiDataRepository.listSizes(),
      aiDataRepository.listPredefinedPizzas(),
      aiDataRepository.listStock(),
      aiDataRepository.getActiveForecast(),
      aiDataRepository.getActiveSupplierScenario(),
    ]);
    return buildSnapshot({ products, sizes, pizzas, stock, forecast, scenario }, clock());
  });
}
