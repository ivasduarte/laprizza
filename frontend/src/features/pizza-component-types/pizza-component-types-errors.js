export function getPizzaComponentTypeErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'pizzaComponentTypes.errors.notFound';
  if (error.status === 409 && action === 'remove') {
    return 'pizzaComponentTypes.errors.inUse';
  }
  if (
    error.status === 400 &&
    action === 'save' &&
    error.fieldErrors.length === 0
  ) {
    return 'pizzaComponentTypes.errors.invalidRules';
  }
  return null;
}

/**
 * After a 409 on save, tells which unique field caused it. The back end does not say whether the
 * name or the assembly order is taken, so the saved data is compared with the current active types
 * (the uniqueness rule itself stays in the back end).
 *
 * @param {{ name: string, assemblyOrder: number }} data - what was sent
 * @param {Array<{ id: string, name: string, assemblyOrder: number, isActive?: boolean }>} types
 * @param {string} [currentId] - the type being edited
 * @returns {Record<string, { type: string }>} field error map for `setErrors`
 */
export function conflictFieldErrors(data, types, currentId) {
  const orderTaken = types.some(
    (type) =>
      type.id !== currentId &&
      type.isActive !== false &&
      type.assemblyOrder === data.assemblyOrder
  );
  return orderTaken
    ? { assemblyOrder: { type: 'pizzaComponentType.orderTaken' } }
    : { name: { type: 'pizzaComponentType.nameTaken' } };
}
