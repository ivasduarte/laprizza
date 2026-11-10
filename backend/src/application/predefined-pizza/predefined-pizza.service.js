import * as defaultPizzaRepository from '../../infrastructure/predefined-pizza/predefined-pizza.repository.js';
import {
  validateSizeIds,
  validateComponentIds,
  validatePizzaProduct,
  validatePredefinedPizza,
  createPredefinedPizzaData,
} from '../../domain/predefined-pizza/predefined-pizza.domain.js';
import { DomainError } from '../../domain/domain-error.js';
import { AppError } from '../app-error.js';
import { cached, invalidate } from '../../infrastructure/cache/cache.js';

export function toPredefinedPizzaDto(pizza) {
  return {
    id: pizza._id || pizza.id,
    productId: pizza.productId ? String(pizza.productId) : pizza.productId,
    sizeIds: (pizza.sizeIds ?? []).map(String),
    defaultConfiguration: {
      componentIds: (pizza.defaultConfiguration?.componentIds ?? []).map(String),
    },
    isActive: pizza.isActive !== false,
  };
}

export function toPredefinedPizzaDetailsDto(pizza, { product, sizes, components, componentTypes }) {
  const typeById = new Map(componentTypes.map((t) => [t.id, t]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const componentById = new Map(components.map((c) => [c.id, c]));

  const base = toPredefinedPizzaDto(pizza);

  const detailedComponents = base.defaultConfiguration.componentIds
    .map((id) => componentById.get(id))
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      componentType: typeById.get(c.componentTypeId) ?? null,
    }))
    .sort(
      (a, b) =>
        (a.componentType?.assemblyOrder ?? Infinity) - (b.componentType?.assemblyOrder ?? Infinity),
    );

  return {
    ...base,
    product: product ? { id: product.id, name: product.name } : null,
    sizes: base.sizeIds.map((id) => sizeById.get(id)).filter(Boolean),
    defaultConfiguration: { components: detailedComponents },
  };
}

function guard(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
}

async function validateReferences(rawSizeIds, rawComponentIds, pizzaRepository) {
  const sizeIds = guard(() => validateSizeIds(rawSizeIds));
  const componentIds = guard(() => validateComponentIds(rawComponentIds));

  const [sizes, components, allComponentTypes] = await Promise.all([
    pizzaRepository.findSizesByIds(sizeIds),
    pizzaRepository.findProductsByIds(componentIds),
    pizzaRepository.listComponentTypes(),
  ]);

  const componentTypes = allComponentTypes.filter((t) => t.isActive !== false);

  guard(() =>
    validatePredefinedPizza({ sizeIds, componentIds, sizes, components, componentTypes }),
  );
  return { sizeIds, componentIds };
}

export async function listPredefinedPizzas(filters = {}, pizzaRepository = defaultPizzaRepository) {
  return cached('predefined-pizza', ['list', filters], 60, async () => {
    const pizzas = filters.name
      ? await pizzaRepository.search(filters.name)
      : await pizzaRepository.list();

    return pizzas.filter((p) => p.isActive !== false).map(toPredefinedPizzaDto);
  });
}

async function buildDetails(pizza, pizzaRepository) {
  const dto = toPredefinedPizzaDto(pizza);
  const [product, sizes, components, componentTypes] = await Promise.all([
    pizzaRepository.findProductById(dto.productId),
    pizzaRepository.findSizesByIds(dto.sizeIds),
    pizzaRepository.findProductsByIds(dto.defaultConfiguration.componentIds),
    pizzaRepository.listComponentTypes(),
  ]);

  return toPredefinedPizzaDetailsDto(pizza, { product, sizes, components, componentTypes });
}

export async function getPredefinedPizzaById(id, pizzaRepository = defaultPizzaRepository) {
  return cached('predefined-pizza', ['id', String(id)], 60, async () => {
    const pizza = await pizzaRepository.findById(id);

    if (!pizza || pizza.isActive === false) {
      throw new AppError('Predefined Pizza not found.', 404);
    }

    return buildDetails(pizza, pizzaRepository);
  });
}

export async function getPredefinedPizzaByName(name, pizzaRepository = defaultPizzaRepository) {
  return cached('predefined-pizza', ['name', String(name)], 60, async () => {
    const pizza = await pizzaRepository.findByName(name);

    if (!pizza || pizza.isActive === false) {
      throw new AppError('Predefined Pizza not found.', 404);
    }

    return buildDetails(pizza, pizzaRepository);
  });
}

export async function createPredefinedPizza(pizzaData, pizzaRepository = defaultPizzaRepository) {
  const product = await pizzaRepository.findProductById(pizzaData.productId);
  guard(() => validatePizzaProduct(product));

  const { sizeIds, componentIds } = await validateReferences(
    pizzaData.sizeIds,
    pizzaData.componentIds,
    pizzaRepository,
  );

  try {
    const created = await pizzaRepository.create(
      createPredefinedPizzaData(pizzaData.productId, sizeIds, componentIds),
    );

    await invalidate('predefined-pizza');

    return toPredefinedPizzaDto(created);
  } catch (err) {
    if (err.code === 11000)
      throw new AppError('A Predefined Pizza already exists for this product.', 409);
    throw err;
  }
}

export async function updatePredefinedPizza(
  id,
  updateData,
  pizzaRepository = defaultPizzaRepository,
) {
  if (updateData.isActive !== undefined && updateData.isActive !== false) {
    throw new AppError('Only deactivation is supported: isActive must be false.', 400);
  }

  const pizza = await pizzaRepository.findById(id);
  if (!pizza || pizza.isActive === false) {
    throw new AppError('Predefined Pizza not found.', 404);
  }

  const changes = {};

  if (updateData.sizeIds !== undefined || updateData.componentIds !== undefined) {
    const current = toPredefinedPizzaDto(pizza);
    const { sizeIds, componentIds } = await validateReferences(
      updateData.sizeIds ?? current.sizeIds,
      updateData.componentIds ?? current.defaultConfiguration.componentIds,
      pizzaRepository,
    );
    changes.sizeIds = sizeIds;
    changes.defaultConfiguration = { componentIds };
  }

  if (updateData.isActive === false) {
    changes.isActive = false;
  }

  if (Object.keys(changes).length === 0) {
    throw new AppError('Nothing to update.', 400);
  }

  const updated = await pizzaRepository.update(id, changes);

  await invalidate('predefined-pizza');

  return toPredefinedPizzaDto(updated);
}
