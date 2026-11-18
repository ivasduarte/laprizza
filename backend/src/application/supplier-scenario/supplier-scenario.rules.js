/**
 * Business rules of a supplier scenario (WEB07). Problems are `{ field, type, message }`;
 * `type` is a stable code translated by the SPA (ai.n.v.<type>).
 */
const problem = (field, type, message) => ({ field, type, message });

/**
 * @param {{suppliers: Array<{id: string}>, products: Array<{productId: string, offers: Array<{supplierId: string}>}>}} data
 * @param {{products: Array<object>}} catalogue active products (lean docs)
 */
export function findSupplierScenarioProblems(data, { products }) {
  const problems = [];
  const knownProducts = new Set(products.map((p) => String(p._id)));

  const supplierIds = new Set();
  (data.suppliers ?? []).forEach((s, i) => {
    if (supplierIds.has(s.id))
      problems.push(problem(`suppliers[${i}].id`, 'supplierIdDuplicate', 'Duplicate supplier id.'));
    supplierIds.add(s.id);
  });

  const productIds = new Set();
  (data.products ?? []).forEach((p, i) => {
    const at = `products[${i}]`;
    const productId = String(p.productId);
    if (!knownProducts.has(productId))
      problems.push(problem(`${at}.productId`, 'productUnknown', 'Unknown product.'));
    if (productIds.has(productId))
      problems.push(problem(`${at}.productId`, 'productDuplicate', 'Duplicate product.'));
    productIds.add(productId);

    const offered = new Set();
    (p.offers ?? []).forEach((o, j) => {
      const field = `${at}.offers[${j}].supplierId`;
      if (!supplierIds.has(o.supplierId))
        problems.push(problem(field, 'offerSupplierUnknown', 'The supplier is not listed.'));
      if (offered.has(o.supplierId))
        problems.push(problem(field, 'offerDuplicate', 'Duplicate offer of the same supplier.'));
      offered.add(o.supplierId);
    });
  });

  return problems;
}
