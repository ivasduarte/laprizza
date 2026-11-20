export function getStockErrorKey(operation, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'stock.errors.notFound';
  if (error.status === 400 && error.fieldErrors.length === 0) {
    return operation === 'decrease'
      ? 'stock.errors.insufficient'
      : 'stock.errors.invalid';
  }
  return null;
}
