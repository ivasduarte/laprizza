export function getStockErrorKey(operation, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'stock.errors.notFound';
  if (error.code === 'STOCK_ABOVE_MAXIMUM') return 'stock.errors.aboveMaximum';
  if (error.status === 400 && error.fieldErrors.length === 0) {
    if (operation === 'decrease') return 'stock.errors.insufficient';
    return operation === 'set'
      ? 'stock.errors.invalidCount'
      : 'stock.errors.invalid';
  }
  return null;
}
