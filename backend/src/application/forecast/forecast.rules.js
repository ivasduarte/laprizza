/**
 * Business rules of a daily consumption forecast (WEB07), independent of Express and Mongoose.
 * Problems are returned as `{ field, type, message }` (same shape as the Joi details), where
 * `type` is a stable code that the SPA translates (ai.n.v.<type>).
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" of a Date (UTC) or of an ISO string. */
export const toDay = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export function isRealDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const problem = (field, type, message) => ({ field, type, message });

/**
 * @param {{startDate: string, endDate: string, entries: Array<{date: string, productId: string, sizeId?: string|null, quantity: number}>}} data
 * @param {{products: Array<object>, pizzas: Array<object>}} catalogue active products (lean docs) and predefined pizzas
 * @returns {Array<{field: string, type: string, message: string}>}
 */
export function findForecastProblems(data, { products, pizzas }) {
  const problems = [];
  const { startDate, endDate, entries = [] } = data;

  if (!isRealDay(startDate))
    problems.push(problem('startDate', 'dateInvalid', 'Invalid start date.'));
  if (!isRealDay(endDate)) problems.push(problem('endDate', 'dateInvalid', 'Invalid end date.'));
  const periodOk = isRealDay(startDate) && isRealDay(endDate);
  if (periodOk && startDate > endDate)
    problems.push(problem('endDate', 'periodInvalid', 'The end date is before the start date.'));
  if (entries.length === 0)
    problems.push(problem('entries', 'noEntries', 'A forecast needs at least one daily quantity.'));

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const sizesOfPizza = new Map(
    pizzas.map((p) => [String(p.productId), new Set((p.sizeIds ?? []).map(String))]),
  );

  const seen = new Set();
  entries.forEach((entry, i) => {
    const at = (name) => `entries[${i}].${name}`;

    if (!isRealDay(entry.date)) problems.push(problem(at('date'), 'dateInvalid', 'Invalid date.'));
    else if (periodOk && (entry.date < startDate || entry.date > endDate))
      problems.push(problem(at('date'), 'dateOutside', 'The date is outside the forecast period.'));

    const productId = String(entry.productId);
    const product = productById.get(productId);
    if (!product || product.sellable !== true) {
      problems.push(problem(at('productId'), 'productUnknown', 'Unknown or not sellable product.'));
    } else {
      const sizes = sizesOfPizza.get(productId);
      const sizeId = entry.sizeId ? String(entry.sizeId) : null;
      if (sizes && sizes.size > 0) {
        if (!sizeId)
          problems.push(problem(at('sizeId'), 'sizeRequired', 'This pizza requires a size.'));
        else if (!sizes.has(sizeId))
          problems.push(
            problem(at('sizeId'), 'sizeIncompatible', 'Size not applicable to the pizza.'),
          );
      } else if (sizeId) {
        problems.push(problem(at('sizeId'), 'sizeIncompatible', 'This product has no sizes.'));
      }
    }

    const key = `${entry.date}|${productId}|${entry.sizeId ?? ''}`;
    if (seen.has(key))
      problems.push(problem(`entries[${i}]`, 'duplicate', 'Duplicate date/product/size entry.'));
    seen.add(key);
  });

  return problems;
}
