import { DomainError } from '../domain-error.js';

function validateIdList(ids, label) {
  if (ids === undefined || ids === null) {
    throw new DomainError(`Invalid Predefined Pizza: ${label} list is required.`);
  }
  if (!Array.isArray(ids)) {
    throw new DomainError(`Invalid Predefined Pizza: ${label} list must be an array.`);
  }
  if (ids.length === 0) {
    throw new DomainError(`Invalid Predefined Pizza: at least one ${label} is required.`);
  }

  const normalized = ids.map(String);
  if (new Set(normalized).size !== normalized.length) {
    throw new DomainError(
      `Invalid Predefined Pizza: the same ${label} cannot occur more than once.`,
    );
  }
  return normalized;
}

export function validateSizeIds(sizeIds) {
  return validateIdList(sizeIds, 'Pizza Size');
}

export function validateComponentIds(componentIds) {
  return validateIdList(componentIds, 'Pizza Component');
}

export function validatePizzaProduct(product) {
  if (!product) {
    throw new DomainError('Invalid Predefined Pizza: Product not found.');
  }
  if (!product.isActive) {
    throw new DomainError('Invalid Predefined Pizza: Product must be active.');
  }
  if (!product.sellable) {
    throw new DomainError('Invalid Predefined Pizza: Product must be sellable.');
  }
  if (product.componentTypeId) {
    throw new DomainError(
      'Invalid Predefined Pizza: a Pizza Component cannot represent a Predefined Pizza.',
    );
  }
  return product;
}

export function validateSizes(sizeIds, sizes) {
  const byId = new Map(sizes.map((s) => [String(s.id), s]));

  const missing = sizeIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new DomainError(`Invalid Predefined Pizza: Pizza Size not found: ${missing.join(', ')}.`);
  }

  const inactive = sizeIds.map((id) => byId.get(id)).filter((s) => !s.isActive);
  if (inactive.length > 0) {
    throw new DomainError(
      `Invalid Predefined Pizza: Pizza Size must be active: ${inactive.map((s) => s.name).join(', ')}.`,
    );
  }
  return sizeIds;
}

export function validateComponents(componentIds, components, componentTypes) {
  const byId = new Map(components.map((c) => [String(c.id), c]));

  const missing = componentIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new DomainError(
      `Invalid Predefined Pizza: Pizza Component not found: ${missing.join(', ')}.`,
    );
  }

  const selected = componentIds.map((id) => byId.get(id));

  const inactive = selected.filter((c) => !c.isActive);
  if (inactive.length > 0) {
    throw new DomainError(
      `Invalid Predefined Pizza: only active products may be Pizza Components: ${inactive.map((c) => c.name).join(', ')}.`,
    );
  }

  const noType = selected.filter((c) => !c.componentTypeId);
  if (noType.length > 0) {
    throw new DomainError(
      `Invalid Predefined Pizza: product is not designated as a Pizza Component: ${noType.map((c) => c.name).join(', ')}.`,
    );
  }

  const typeById = new Map(componentTypes.map((t) => [String(t.id), t]));
  const countByType = new Map();
  for (const component of selected) {
    if (!typeById.has(component.componentTypeId)) {
      throw new DomainError(
        `Invalid Predefined Pizza: unknown Pizza Component Type for ${component.name}.`,
      );
    }
    countByType.set(
      component.componentTypeId,
      (countByType.get(component.componentTypeId) || 0) + 1,
    );
  }

  for (const type of componentTypes) {
    const count = countByType.get(String(type.id)) || 0;
    const min = type.minQuantity ?? 0;
    const max = type.maxQuantity ?? null;

    if (count < min) {
      throw new DomainError(
        `Invalid Predefined Pizza: Pizza Component Type "${type.name}" requires at least ${min} component(s), found ${count}.`,
      );
    }
    if (max !== null && count > max) {
      throw new DomainError(
        `Invalid Predefined Pizza: Pizza Component Type "${type.name}" allows at most ${max} component(s), found ${count}.`,
      );
    }
  }
  return componentIds;
}

export function validateSizeAvailability(components, sizes) {
  const missing = [];
  for (const size of sizes) {
    for (const component of components) {
      if (!component.configuredSizeIds.includes(String(size.id))) {
        missing.push(`${component.name} / ${size.name}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new DomainError(
      `Invalid Predefined Pizza: missing Component Size Configuration for: ${missing.join('; ')}.`,
    );
  }
}

export function validatePredefinedPizza({
  sizeIds,
  componentIds,
  sizes,
  components,
  componentTypes,
}) {
  validateSizes(sizeIds, sizes);
  validateComponents(componentIds, components, componentTypes);

  const sizeById = new Map(sizes.map((s) => [String(s.id), s]));
  const componentById = new Map(components.map((c) => [String(c.id), c]));
  validateSizeAvailability(
    componentIds.map((id) => componentById.get(id)),
    sizeIds.map((id) => sizeById.get(id)),
  );
}

export function createPredefinedPizzaData(productId, sizeIds, componentIds) {
  return {
    productId: String(productId),
    sizeIds,
    defaultConfiguration: { componentIds },
  };
}
