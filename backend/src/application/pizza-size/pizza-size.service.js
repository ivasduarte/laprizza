import * as defaultSizeRepo from '../../infrastructure/pizza-size/pizza-size.repository.js';
import * as defaultProductsRepo from '../../infrastructure/products/products.repository.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { validatePizzaSize } from '../../domain/pizza-size/pizza-size.domain.js';

export function toSizeDto(size) {
  return {
    id: size._id || size.id,
    name: size.name,
    isActive: size.isActive ?? true,
  };
}

export async function createSize(sizeData, sizeRepository = defaultSizeRepo) {
  try {
    sizeData.name = await validatePizzaSize(sizeData.name);

    const newSize = await sizeRepository.create(sizeData);
    return toSizeDto(newSize);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    if (err.code === 11000) throw toConflictError();
    throw err;
  }
}

export async function listSizes(query = {}, sizeRepository = defaultSizeRepo) {
  const sizes = await sizeRepository.listPizzaSizes(query);
  return sizes.map(toSizeDto);
}

export async function getSizeById(id, sizeRepository = defaultSizeRepo) {
  const size = await sizeRepository.findById(id);
  if (!size) throw new AppError('Pizza size not found.', 404);
  return toSizeDto(size);
}

export async function updateSize(
  id,
  updateData,
  sizeRepository = defaultSizeRepo,
  productsRepository = defaultProductsRepo,
) {
  const size = await sizeRepository.findById(id);
  if (!size) throw new AppError('Pizza size not found.', 404);

  if (updateData.isActive === false && size.isActive !== false) {
    const isInUse = await productsRepository.existsWithSizeConfigurationForPizzaSize(id);
    if (isInUse) {
      throw new AppError('Pizza size has size configurations and cannot be removed.', 409);
    }
  }

  try {
    if (updateData.name !== undefined) {
      updateData.name = await validatePizzaSize(updateData.name);
    }
    const updatedSize = await sizeRepository.update(id, updateData);
    return toSizeDto(updatedSize);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    if (err.code === 11000) throw toConflictError();
    throw err;
  }
}

function toConflictError() {
  return new AppError('Pizza size already in use.', 409);
}
