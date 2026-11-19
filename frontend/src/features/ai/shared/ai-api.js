import { api } from '../../../shared/api/index.js';

/**
 * WEB07 endpoints (MANAGER only). Failures are explained inline by each panel, so reads and
 * writes are `silent`; network/5xx failures are still classified by the panels themselves.
 */
const silent = (signal) => ({ signal, feedback: 'silent' });
const byId = (base, id) => `${base}/${encodeURIComponent(id)}`;

export const aiKeys = Object.freeze({
  all: ['ai'],
  forecasts: ['ai', 'forecasts'],
  suppliers: ['ai', 'supplier-scenarios'],
  catalogue: ['ai', 'catalogue'],
  productsExport: ['ai', 'products-export'],
  runs: (filters = {}) => ['ai', 'runs', filters],
  run: (id) => ['ai', 'run', id],
});

/** Forecasts are immutable and versioned: "edit" = POST with the same name (next version). */
export const forecastsApi = {
  list: (signal) => api.get('/forecasts', silent(signal)),
  get: (id, signal) => api.get(byId('/forecasts', id), silent(signal)),
  create: (body) => api.post('/forecasts', body, { feedback: 'silent' }),
  deactivate: (id) =>
    api.put(
      byId('/forecasts', id),
      { isActive: false },
      { feedback: 'silent' }
    ),
};

export const supplierScenariosApi = {
  list: (signal) => api.get('/supplier-scenarios', silent(signal)),
  get: (id, signal) => api.get(byId('/supplier-scenarios', id), silent(signal)),
  /** Dry-run: same rules as create, nothing is stored. Resolves `{ valid, nextVersion }`. */
  validate: (body) =>
    api.post('/supplier-scenarios/validate', body, { feedback: 'silent' }),
  create: (body) =>
    api.post('/supplier-scenarios', body, { feedback: 'silent' }),
  deactivate: (id) =>
    api.put(
      byId('/supplier-scenarios', id),
      { isActive: false },
      { feedback: 'silent' }
    ),
};

export const aiDataApi = {
  exportProducts: (signal) =>
    api.get('/ai-data/products/export', silent(signal)),
};

/**
 * Sellable products, predefined pizzas (allowed sizes) and size names: what the forecast
 * editor needs to offer only valid product/size combinations.
 */
export async function loadForecastCatalogue(signal) {
  const [products, pizzas, sizes] = await Promise.all([
    api.get('/products', {
      ...silent(signal),
      query: { sellable: true, isActive: true },
    }),
    api.get('/predefined-pizzas', silent(signal)),
    api.get('/pizza-size', silent(signal)),
  ]);
  return { products, pizzas, sizes };
}

/** Saved results (one per successful calculation). The list has no `result`. */
export const planningRunsApi = {
  list: (filters, signal) =>
    api.get('/planning/runs', { ...silent(signal), query: filters }),
  get: (id, signal) => api.get(byId('/planning/runs', id), silent(signal)),
};
