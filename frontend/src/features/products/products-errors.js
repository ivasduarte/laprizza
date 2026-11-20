export function getProductErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.code?.startsWith('AGGREGATE_')) {
    return `products.errors.aggregate.${error.code}`;
  }
  if (error.status === 404) {
    return action === 'save'
      ? 'products.errors.referenceNotFound'
      : 'products.errors.notFound';
  }
  if (error.status === 409 && action === 'deactivate') {
    return 'products.errors.inUse';
  }
  // Domain rules (blank name/description, sellable without price) come back without details.
  if (
    error.status === 400 &&
    action === 'save' &&
    error.fieldErrors.length === 0
  ) {
    return 'products.errors.invalid';
  }
  return null;
}

export function getSizeConfigErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.status === 409) return 'products.sizeConfigs.errors.duplicate';
  if (error.status === 404) {
    return action === 'remove'
      ? 'products.sizeConfigs.errors.notFound'
      : 'products.sizeConfigs.errors.unavailable';
  }
  // Domain rules (not a pizza component, stock units against stock control) have no details.
  if (error.status === 400 && error.fieldErrors.length === 0) {
    return 'products.sizeConfigs.errors.invalid';
  }
  return null;
}
