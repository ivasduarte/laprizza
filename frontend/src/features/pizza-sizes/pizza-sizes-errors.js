export function getPizzaSizeErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'pizzaSizes.errors.notFound';
  if (error.status === 409) {
    return action === 'deactivate'
      ? 'pizzaSizes.errors.inUse'
      : 'pizzaSizes.errors.duplicate';
  }
  return null;
}