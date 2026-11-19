/**
 * Pure logic of the forecast editor (WEB07). Mirrors the back-end rules (Joi + forecast.rules.js)
 * with the same `{ field, type }` output, so most mistakes are caught before the request and
 * both sides share one translation path. The back end stays the final authority.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `YYYY-MM-DD` of a day sent by the API. Tolerates full ISO timestamps
 * (`2026-12-01T00:00:00.000Z`), which `<input type="date">` would show as empty.
 */
export function toDay(value) {
  if (typeof value !== 'string') return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;
}

export function isRealDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const byName = (a, b) =>
  String(a.name).localeCompare(String(b.name), undefined, {
    sensitivity: 'base',
  });

/**
 * Products a forecast may reference: active and sellable. A predefined pizza has the sizes of
 * its definition (size mandatory); any other product has none (size forbidden).
 *
 * @returns {Array<{id: string, name: string, sizes: Array<{id: string, name: string}>}>}
 */
export function buildProductOptions({
  products = [],
  pizzas = [],
  sizes = [],
} = {}) {
  const sizeName = new Map(sizes.map((s) => [String(s.id), s.name]));
  const sizesOf = new Map(
    pizzas
      .filter((p) => p.isActive !== false)
      .map((p) => [String(p.productId), (p.sizeIds ?? []).map(String)])
  );
  return products
    .filter((p) => p.sellable === true && p.isActive !== false)
    .map((p) => ({
      id: String(p.id),
      name: p.name,
      sizes: (sizesOf.get(String(p.id)) ?? []).map((id) => ({
        id,
        name: sizeName.get(id) ?? id,
      })),
    }))
    .sort(byName);
}

export const emptyEntry = () => ({
  date: '',
  productId: '',
  sizeId: '',
  quantity: '',
});

export const emptyForm = () => ({
  name: '',
  startDate: '',
  endDate: '',
  entries: [emptyEntry()],
});

/** Prefills the editor with an existing version (to save the next version of the same name). */
export function fromForecast(forecast) {
  return {
    name: forecast.name,
    startDate: toDay(forecast.startDate),
    endDate: toDay(forecast.endDate),
    entries: (forecast.entries ?? []).map((e) => ({
      date: toDay(e.date),
      productId: String(e.productId),
      sizeId: e.sizeId ? String(e.sizeId) : '',
      quantity: String(e.quantity),
    })),
  };
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** Request body. `version` is never sent: the back end assigns it. */
export function toPayload(form) {
  return {
    name: form.name.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    entries: form.entries.map((e) => ({
      date: e.date,
      productId: e.productId,
      sizeId: e.sizeId || null,
      quantity: Number(e.quantity),
    })),
  };
}

/**
 * @param {ReturnType<typeof emptyForm>} form
 * @param {ReturnType<typeof buildProductOptions>} options
 * @returns {Array<{field: string, type: string, limit?: number}>}
 */
export function validateForecast(form, options) {
  const problems = [];
  const add = (field, type, extra = {}) =>
    problems.push({ field, type, ...extra });

  if (isBlank(form.name)) add('name', 'any.required');

  const checkDay = (field, value) => {
    if (isBlank(value)) add(field, 'any.required');
    else if (!isRealDay(value)) add(field, 'ai.dateInvalid');
  };
  checkDay('startDate', form.startDate);
  checkDay('endDate', form.endDate);
  const periodOk = isRealDay(form.startDate) && isRealDay(form.endDate);
  if (periodOk && form.startDate > form.endDate)
    add('endDate', 'ai.periodInvalid');

  if (form.entries.length === 0) add('entries', 'ai.noEntries');

  const productById = new Map(options.map((o) => [o.id, o]));
  const seen = new Set();
  form.entries.forEach((entry, i) => {
    const at = (name) => `entries.${i}.${name}`;

    if (isBlank(entry.date)) add(at('date'), 'any.required');
    else if (!isRealDay(entry.date)) add(at('date'), 'ai.dateInvalid');
    else if (
      periodOk &&
      (entry.date < form.startDate || entry.date > form.endDate)
    )
      add(at('date'), 'ai.dateOutside');

    const product = productById.get(entry.productId);
    if (isBlank(entry.productId)) add(at('productId'), 'any.required');
    else if (!product) add(at('productId'), 'ai.productUnknown');
    else if (product.sizes.length > 0) {
      if (isBlank(entry.sizeId)) add(at('sizeId'), 'ai.sizeRequired');
      else if (!product.sizes.some((s) => s.id === entry.sizeId))
        add(at('sizeId'), 'ai.sizeIncompatible');
    } else if (!isBlank(entry.sizeId)) {
      add(at('sizeId'), 'ai.sizeIncompatible');
    }

    const q = entry.quantity;
    if (isBlank(q)) add(at('quantity'), 'any.required');
    else if (!Number.isFinite(Number(q))) add(at('quantity'), 'number.base');
    else if (!Number.isInteger(Number(q)))
      add(at('quantity'), 'number.integer');
    else if (Number(q) < 0) add(at('quantity'), 'number.min', { limit: 0 });

    const key = `${entry.date}|${entry.productId}|${entry.sizeId || ''}`;
    if (!isBlank(entry.date) && !isBlank(entry.productId)) {
      if (seen.has(key)) add(`entries.${i}`, 'ai.duplicate');
      seen.add(key);
    }
  });

  return problems;
}

/**
 * Active forecasts grouped by name (case-insensitive, like the versioning on the back end),
 * newest version first.
 *
 * @returns {Array<{key: string, name: string, latest: object, versions: Array<object>}>}
 */
export function groupForecasts(forecasts = []) {
  const groups = new Map();
  for (const forecast of forecasts) {
    const key = String(forecast.name).toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(forecast);
  }
  return [...groups.entries()]
    .map(([key, versions]) => {
      versions.sort((a, b) => b.version - a.version);
      return { key, name: versions[0].name, latest: versions[0], versions };
    })
    .sort(byName);
}

/** Days with at least one entry: the demo needs consumption that varies on 2+ days. */
export function countDays(entries = []) {
  return new Set(entries.map((e) => toDay(e.date))).size;
}
