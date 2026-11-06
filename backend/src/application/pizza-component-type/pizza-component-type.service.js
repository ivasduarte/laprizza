import * as defaultPizzaComponentTypeRepository from '../../infrastructure/pizza-component-type/pizza-component-type.repository.js';
import * as defaultProductsRepository from '../../infrastructure/products/products.repository.js';
import {
  normalizeName,
  normalizeMaxQuantity,
  validateName,
  validateAssemblyOrder,
  validateMinQuantity,
  validateMaxQuantity,
  validateQuantityRange,
} from '../../domain/pizza-component-type/pizza-component-types.domain.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { invalidate } from '../../infrastructure/cache/cache.js';

/** MongoDB error code for violation of a unique index. */
const DUPLICATE_KEY_ERROR_CODE = 11000;

export function toPizzaComponentTypeDTO(type) {
  return {
    id: type._id || type.id,
    name: type.name,
    assemblyOrder: type.assemblyOrder,
    minQuantity: type.minQuantity,
    maxQuantity: type.maxQuantity,
    isActive: type.isActive ?? true,
  };
}

function buildValidPizzaComponentType(typeData) {
  const name = normalizeName(typeData?.name);
  const assemblyOrder = typeData?.assemblyOrder;
  const minQuantity = typeData?.minQuantity;
  const maxQuantity = normalizeMaxQuantity(typeData?.maxQuantity);

  try {
    validateName(name);
    validateAssemblyOrder(assemblyOrder);
    validateMinQuantity(minQuantity);
    validateMaxQuantity(maxQuantity);
    validateQuantityRange(minQuantity, maxQuantity);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }

  return { name, assemblyOrder, minQuantity, maxQuantity };
}

function handleDuplicate(err) {
  if (err.code === DUPLICATE_KEY_ERROR_CODE) {
    if (err.keyPattern?.assemblyOrder) {
      throw new AppError('A pizza component type with this assembly order already exists.', 409);
    }
    throw new AppError('A pizza component type with this name already exists.', 409);
  }
  throw err;
}

export async function listPizzaComponentTypes(
  name,
  pizzaComponentTypeRepository = defaultPizzaComponentTypeRepository,
) {
  const types =
    name === undefined
      ? await pizzaComponentTypeRepository.listPizzaComponentTypes()
      : await pizzaComponentTypeRepository.searchByName(name);

  return types.map(toPizzaComponentTypeDTO);
}

export async function createPizzaComponentType(
  typeData,
  pizzaComponentTypeRepository = defaultPizzaComponentTypeRepository,
) {
  const validData = buildValidPizzaComponentType(typeData);

  try {
    const type = await pizzaComponentTypeRepository.create(validData);
    await invalidate('predefined-pizza');
    return toPizzaComponentTypeDTO(type);
  } catch (err) {
    return handleDuplicate(err);
  }
}

export async function getPizzaComponentTypeById(
  id,
  pizzaComponentTypeRepository = defaultPizzaComponentTypeRepository,
) {
  const type = await pizzaComponentTypeRepository.findById(id);
  if (!type) throw new AppError('Pizza Component Type not found.', 404);

  return toPizzaComponentTypeDTO(type);
}

export async function updatePizzaComponentType(
  id,
  updateData,
  pizzaComponentTypeRepository = defaultPizzaComponentTypeRepository,
) {
  const validData = buildValidPizzaComponentType(updateData);

  const type = await pizzaComponentTypeRepository.findById(id);
  if (!type || !type.isActive) throw new AppError('Pizza Component Type not found.', 404);

  let updatedType;

  try {
    updatedType = await pizzaComponentTypeRepository.update(id, validData);
  } catch (err) {
    return handleDuplicate(err);
  }

  if (!updatedType) throw new AppError('Pizza Component Type not found.', 404);

  await invalidate('predefined-pizza');
  return toPizzaComponentTypeDTO(updatedType);
}

export async function removePizzaComponentType(
  id,
  pizzaComponentTypeRepository = defaultPizzaComponentTypeRepository,
  productsRepository = defaultProductsRepository,
) {
  const type = await pizzaComponentTypeRepository.findById(id);
  if (!type || !type.isActive) throw new AppError('Pizza Component Type not found.', 404);

  const isReferenced = await productsRepository.existsByPizzaComponentType(id);
  if (isReferenced) {
    throw new AppError('Cannot remove a referenced pizza component type.', 409);
  }

  await pizzaComponentTypeRepository.update(id, {
    isActive: false,
  });
  await invalidate('predefined-pizza');
}
