/**
 * Pure logic of the supplier JSON import (WEB07): parse, local structure checks (same paths and
 * types as the back-end Joi schema and supplier-scenario.rules.js) and the preview rows.
 * Product references are checked by the server dry-run (POST /supplier-scenarios/validate),
 * which knows every active product.
 */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const isBlankString = (v) => typeof v !== 'string' || v.trim() === '';

/**
 * @returns {{ok: true, data: object} | {ok: false, error: {type: string, line?: number, column?: number}}}
 */
export function parseSupplierJson(text) {
  if (isBlankString(text))
    return { ok: false, error: { type: 'ai.jsonEmpty' } };
  try {
    const data = JSON.parse(text);
    if (!isObject(data))
      return { ok: false, error: { type: 'ai.jsonNotObject' } };
    return { ok: true, data };
  } catch (err) {
    const position = /position (\d+)/.exec(String(err?.message))?.[1];
    if (position === undefined)
      return { ok: false, error: { type: 'ai.jsonSyntax' } };
    const before = text.slice(0, Number(position)).split('\n');
    return {
      ok: false,
      error: {
        type: 'ai.jsonSyntaxAt',
        line: before.length,
        column: before[before.length - 1].length + 1,
      },
    };
  }
}

/**
 * Body sent to the back end. The scenario name typed on the page wins over the file; the
 * fields the back end ignores (`version`, `simulated`) are not sent.
 */
export function toScenarioPayload(data, name) {
  return {
    name:
      (name ?? '').trim() ||
      (typeof data.name === 'string' ? data.name.trim() : ''),
    suppliers: data.suppliers,
    products: data.products,
  };
}

/**
 * @returns {Array<{field: string, type: string, limit?: number}>} empty when the structure is valid
 */
export function validateScenarioStructure(payload) {
  const problems = [];
  const add = (field, type, extra = {}) =>
    problems.push({ field, type, ...extra });
  const number = (field, value, { min, integer, required = true }) => {
    if (value === undefined || value === null) {
      if (required) add(field, 'any.required');
      return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      return add(field, 'number.base');
    if (integer && !Number.isInteger(value))
      return add(field, 'number.integer');
    if (value < min) add(field, 'number.min', { limit: min });
  };

  if (isBlankString(payload.name)) add('name', 'any.required');

  const supplierIds = new Set();
  if (!Array.isArray(payload.suppliers)) add('suppliers', 'any.required');
  else
    payload.suppliers.forEach((s, i) => {
      const at = `suppliers.${i}`;
      if (!isObject(s)) return add(at, 'object.base');
      if (isBlankString(s.id)) return add(`${at}.id`, 'any.required');
      const id = s.id.trim();
      if (supplierIds.has(id)) add(`${at}.id`, 'ai.supplierIdDuplicate');
      supplierIds.add(id);
      if (s.name !== undefined && typeof s.name !== 'string')
        add(`${at}.name`, 'string.base');
    });

  const productIds = new Set();
  if (!Array.isArray(payload.products)) add('products', 'any.required');
  else
    payload.products.forEach((p, i) => {
      const at = `products.${i}`;
      if (!isObject(p)) return add(at, 'object.base');
      if (isBlankString(p.productId)) add(`${at}.productId`, 'any.required');
      else if (!OBJECT_ID.test(p.productId))
        add(`${at}.productId`, 'string.hex');
      else {
        if (productIds.has(p.productId))
          add(`${at}.productId`, 'ai.productDuplicate');
        productIds.add(p.productId);
      }

      if (!Array.isArray(p.offers)) return add(`${at}.offers`, 'any.required');
      const offered = new Set();
      p.offers.forEach((o, j) => {
        const of = `${at}.offers.${j}`;
        if (!isObject(o)) return add(of, 'object.base');
        if (isBlankString(o.supplierId))
          add(`${of}.supplierId`, 'any.required');
        else {
          const sid = o.supplierId.trim();
          if (Array.isArray(payload.suppliers) && !supplierIds.has(sid))
            add(`${of}.supplierId`, 'ai.offerSupplierUnknown');
          if (offered.has(sid)) add(`${of}.supplierId`, 'ai.offerDuplicate');
          offered.add(sid);
        }
        number(`${of}.priceEur`, o.priceEur, { min: 0 });
        number(`${of}.stockUnits`, o.stockUnits, { min: 1, integer: true });
        number(`${of}.leadTimeDays`, o.leadTimeDays, { min: 0 });
        number(`${of}.supplyLimit`, o.supplyLimit, {
          min: 0,
          integer: true,
          required: false,
        });
      });
    });

  return problems;
}

/**
 * Preview of a scenario (imported or saved): one row per offer, plus one "no supplier" row for
 * every product with no offers, including purchasable exported products missing from the file.
 *
 * @param {{suppliers: Array, products: Array}} scenario
 * @param {Array<{id: string, name: string, kind: string}>} exported products of GET /ai-data/products/export
 */
export function buildPreviewRows(scenario, exported = []) {
  const productName = new Map(exported.map((p) => [String(p.id), p.name]));
  const supplierName = new Map(
    (scenario.suppliers ?? []).map((s) => [s.id, (s.name ?? '').trim() || s.id])
  );
  const rows = [];
  const listed = new Set();

  for (const product of scenario.products ?? []) {
    const productId = String(product.productId);
    listed.add(productId);
    const name = productName.get(productId) ?? null;
    if (!product.offers?.length) {
      rows.push({
        key: `${productId}-none`,
        productId,
        productName: name,
        offer: null,
      });
      continue;
    }
    product.offers.forEach((offer, i) =>
      rows.push({
        key: `${productId}-${i}`,
        productId,
        productName: name,
        offer: {
          ...offer,
          supplierName: supplierName.get(offer.supplierId) ?? offer.supplierId,
          unitPriceEur:
            typeof offer.priceEur === 'number' && offer.stockUnits > 0
              ? offer.priceEur / offer.stockUnits
              : null,
        },
      })
    );
  }

  // The export only has purchasable products (produced aggregates are left out): those not
  // in the file have no supplier either.
  for (const product of exported) {
    if (!listed.has(String(product.id)))
      rows.push({
        key: `${product.id}-missing`,
        productId: String(product.id),
        productName: product.name,
        offer: null,
        missing: true,
      });
  }
  return rows;
}

/** Example file built from the exported products, so its ids are valid in this database. */
export function buildExample(exported = []) {
  const [first, second] = exported;
  const offer = (
    supplierId,
    priceEur,
    stockUnits,
    leadTimeDays,
    extra = {}
  ) => ({
    supplierId,
    priceEur,
    stockUnits,
    leadTimeDays,
    ...extra,
  });
  return {
    name: 'Fornecedores demo',
    suppliers: [
      { id: 'SUP-A', name: 'Fornecedor A' },
      { id: 'SUP-B', name: 'Fornecedor B' },
    ],
    products: [
      first && {
        productId: first.id,
        offers: [
          offer('SUP-A', 12.5, 50, 2, { supplyLimit: 500 }),
          offer('SUP-B', 11, 50, 5),
        ],
      },
      second && { productId: second.id, offers: [] },
    ].filter(Boolean),
  };
}
