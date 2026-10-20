import * as defaultProductsRepository from '../infrastructure/products.repository.js';
import * as defaultSizeRepository from '../infrastructure/pizza-size.repository.js';
import {
  findSizeConfiguration,
  normalizeStockUnitsConsumed,
  validateStockUnitsConsumed,
  validateProductIsPizzaComponent,
  validatePizzaSizeId,
  validatePrice,
} from '../domain/component-size-configuration.domain.js';
import { AppError } from './AppError.js';
import { DomainError } from '../domain/domain-error.js';

export function toComponentSizeConfigurationDTO(productId, config) {
  return {
    productId: String(productId),
    pizzaSizeId: String(config.pizzaSizeId),
    price: config.price,
    stockUnitsConsumed: config.stockUnitsConsumed ?? null,
  };
}

function resolveRepositories(repositories = {}) {
  return {
    productsRepository: repositories.productsRepository ?? defaultProductsRepository,
    sizeRepository: repositories.sizeRepository ?? defaultSizeRepository,
  };
}

function validateDomain(validation) {
  try {
    validation();
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
}

async function getProduct(productId, productsRepository, { requireActive = false } = {}) {
  const product = await productsRepository.findById(productId);
  if (!product || (requireActive && product.isActive === false)) {
    throw new AppError('Product not found', 404);
  }
  return product;
}

function getConfiguration(product, pizzaSizeId) {
  const config = findSizeConfiguration(product, pizzaSizeId);
  if (!config) throw new AppError('Component Size Configuration not found', 404);
  return config;
}

export async function listComponentSizeConfigurations(productId, repositories) {
  const { productsRepository } = resolveRepositories(repositories);

  const prod = await getProduct(productId, productsRepository);

  return (prod.sizeConfigurations ?? []).map((config) =>
    toComponentSizeConfigurationDTO(productId, config),
  );
}

export async function createComponentSizeConfiguration(productId, data, repositories) {
  const { productsRepository, sizeRepository } = resolveRepositories(repositories);

  const pizzaSizeId = data?.pizzaSizeId;
  const price = data?.price;
  const stockUnitsConsumed = normalizeStockUnitsConsumed(data?.stockUnitsConsumed);

  validateDomain(() => {
    validatePizzaSizeId(pizzaSizeId);
    validatePrice(price);
  });

  const product = await getProduct(productId, productsRepository, { requireActive: true });
  validateDomain(() => validateProductIsPizzaComponent(product));

  const size = await sizeRepository.findById(pizzaSizeId);
  if (!size || size.isActive === false) throw new AppError('Pizza Size not found', 404);

  validateDomain(() => validateStockUnitsConsumed(product.stockControlled, stockUnitsConsumed));

  const duplicateError = new AppError(
    'A size configuration for this pizza size already exists for this component.',
    409,
  );
  if (findSizeConfiguration(product, pizzaSizeId)) throw duplicateError;

  const updatedProduct = await productsRepository.addSizeConfiguration(productId, {
    pizzaSizeId,
    price,
    stockUnitsConsumed,
  });

  if (!updatedProduct) throw duplicateError;

  return toComponentSizeConfigurationDTO(productId, getConfiguration(updatedProduct, pizzaSizeId));
}

export async function getComponentSizeConfiguration(productId, pizzaSizeId, repositories) {
  const { productsRepository } = resolveRepositories(repositories);

  const product = await getProduct(productId, productsRepository);

  return toComponentSizeConfigurationDTO(productId, getConfiguration(product, pizzaSizeId));
}

export async function updateComponentSizeConfiguration(
  productId,
  pizzaSizeId,
  updateData,
  repositories,
) {
  const { productsRepository } = resolveRepositories(repositories);

  const price = updateData?.price;
  const stockUnitsConsumed = normalizeStockUnitsConsumed(updateData?.stockUnitsConsumed);

  validateDomain(() => validatePrice(price));

  const prod = await getProduct(productId, productsRepository, { requireActive: true });
  validateDomain(() => validateProductIsPizzaComponent(prod));

  getConfiguration(prod, pizzaSizeId);

  validateDomain(() => validateStockUnitsConsumed(prod.stockControlled, stockUnitsConsumed));

  const updatedProduct = await productsRepository.updateSizeConfiguration(productId, pizzaSizeId, {
    price,
    stockUnitsConsumed,
  });
  if (!updatedProduct) throw new AppError('Component Size Configuration not found', 404);

  return toComponentSizeConfigurationDTO(productId, getConfiguration(updatedProduct, pizzaSizeId));
}

export async function removeComponentSizeConfiguration(productId, pizzaSizeId, repositories) {
  const { productsRepository } = resolveRepositories(repositories);

  const product = await getProduct(productId, productsRepository);
  const config = getConfiguration(product, pizzaSizeId);

  const updatedProduct = await productsRepository.removeSizeConfiguration(productId, pizzaSizeId);
  if (!updatedProduct) throw new AppError('Component Size Configuration not found', 404);

  return toComponentSizeConfigurationDTO(productId, config);
}
