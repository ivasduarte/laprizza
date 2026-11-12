import * as productsRepository from '../../infrastructure/products/products.repository.js';
import * as categoriesRepository from '../../infrastructure/product-categories/product-categories.repository.js';
import * as allergensRepository from '../../infrastructure/allergen/allergen.repository.js';
import * as pizzaComponentTypesRepository from '../../infrastructure/pizza-component-type/pizza-component-type.repository.js';
import * as stockRepository from '../../infrastructure/stock/stock.repository.js';
import * as predefinedPizzaRepository from '../../infrastructure/predefined-pizza/predefined-pizza.repository.js';
import {
  validateProductName,
  validateProductDescription,
  normalizeAggregate,
  validateAggregateShape,
  validateAggregateItems,
  validateAggregateOwner,
} from '../../domain/products/products.domain.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { invalidate } from '../../infrastructure/cache/cache.js';

function toAggregateDTO(aggregate) {
  if (!aggregate) return null;
  return {
    classification: aggregate.classification,
    items: (aggregate.items ?? []).map((item) => ({
      productId: String(item.productId?._id ?? item.productId),
      quantity: item.quantity,
    })),
  };
}

export function toProductDTO(product) {
  return {
    id: product._id || product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    sellable: product.sellable,
    stockControlled: product.stockControlled,
    categoryId: product.categoryId?._id || product.categoryId,
    isPizzaComponent: !!product.pizzaComponentTypeId,
    pizzaComponentTypeId: product.pizzaComponentTypeId?._id || product.pizzaComponentTypeId || null,
    allergenIds: product.allergenIds?.map((a) => a._id || a) || [],
    aggregate: toAggregateDTO(product.aggregate),
    isActive: product.isActive ?? true,
  };
}

async function validateAggregate(productId, aggregate, repos) {
  const normalized = normalizeAggregate(aggregate);
  if (normalized === null) return null;

  try {
    validateAggregateShape(productId, normalized);

    if (productId) {
      const [ownerPizzaIds, isItemOfAggregate] = await Promise.all([
        repos.predefinedPizzaRepository.findPizzaProductIds([String(productId)]),
        repos.productsRepository.existsAggregateWithItem(productId),
      ]);
      validateAggregateOwner({ isPizza: ownerPizzaIds.length > 0, isItemOfAggregate });
    }
    const itemIds = normalized.items.map((item) => item.productId);
    if (itemIds.length > 0) {
      const [itemProducts, pizzaProductIds] = await Promise.all([
        repos.productsRepository.findAggregateInfoByIds(itemIds),
        repos.predefinedPizzaRepository.findPizzaProductIds(itemIds),
      ]);
      validateAggregateItems(normalized.items, itemProducts, pizzaProductIds);
    }
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400, null, err.code);
    throw err;
  }

  return normalized;
}

async function validateReferences(data, repos) {
  if (data.categoryId) {
    const category = await repos.categoriesRepository.findById(data.categoryId);
    if (!category || category.isActive === false)
      throw new AppError('Product Category not found or inactive.', 404);
  }

  if (data.pizzaComponentTypeId) {
    const pizzaComponentType = await repos.pizzaComponentTypesRepository.findById(
      data.pizzaComponentTypeId,
    );
    if (!pizzaComponentType || pizzaComponentType.isActive === false)
      throw new AppError('Pizza Component Type not found or inactive.', 404);
  }

  if (data.allergenIds && data.allergenIds.length > 0) {
    for (const allergenId of data.allergenIds) {
      const allergen = await repos.allergensRepository.findById(allergenId);
      if (!allergen || allergen.isActive === false)
        throw new AppError(`Allergen ${allergenId} not found or inactive.`, 404);
    }
  }
}

export async function listProducts(query = {}, repos = { productsRepository }) {
  const products = await repos.productsRepository.listProducts(query);
  return products.map(toProductDTO);
}

export async function getProductById(id, repos = { productsRepository }) {
  const product = await repos.productsRepository.findById(id);
  if (!product) throw new AppError('Product not found.', 404);
  return toProductDTO(product);
}

export async function createProduct(
  data,
  repos = {
    productsRepository,
    categoriesRepository,
    allergensRepository,
    pizzaComponentTypesRepository,
    stockRepository,
    predefinedPizzaRepository,
  },
) {
  try {
    data.name = validateProductName(data.name);
    data.description = validateProductDescription(data.description);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
  if (data.sellable && (data.price === undefined || data.price === null || data.price < 0)) {
    throw new AppError('Sellable products must have a valid price.', 400);
  }

  await validateReferences(data, repos);

  if (data.aggregate !== undefined) {
    data.aggregate = await validateAggregate(null, data.aggregate, repos);
  }

  const existingProduct = await repos.productsRepository.findByName(data.name);
  if (existingProduct) {
    throw new AppError('A product with this name already exists.', 409);
  }

  const product = await repos.productsRepository.create(data);

  if (product.stockControlled) {
    await repos.stockRepository.create({
      productId: product._id,
      quantity: 0,
    });
  }

  await invalidate('catalogue', 'predefined-pizza', 'ai-data');
  return toProductDTO(product);
}

export async function updateProduct(
  id,
  updateData,
  repos = {
    productsRepository,
    categoriesRepository,
    allergensRepository,
    pizzaComponentTypesRepository,
    predefinedPizzaRepository,
  },
) {
  const product = await repos.productsRepository.findById(id);
  if (!product) throw new AppError('Product not found.', 404);

  try {
    if (updateData.name !== undefined) updateData.name = validateProductName(updateData.name);
    if (updateData.description !== undefined)
      updateData.description = validateProductDescription(updateData.description);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }

  if (
    updateData.isActive === false &&
    product.isActive !== false &&
    product.sizeConfigurations?.length > 0
  ) {
    throw new AppError('Product has size configurations and cannot be removed.', 409);
  }

  const isSellable = updateData.sellable !== undefined ? updateData.sellable : product.sellable;
  const price = updateData.price !== undefined ? updateData.price : product.price;

  if (isSellable && (price === undefined || price === null || price < 0)) {
    throw new AppError('Sellable products must have a valid price.', 400);
  }

  await validateReferences(updateData, repos);

  if (updateData.pizzaComponentTypeId === null) {
    updateData.pizzaComponentTypeId = null;
  }

  const aggregateChanged = updateData.aggregate !== undefined;
  if (aggregateChanged) {
    updateData.aggregate = await validateAggregate(id, updateData.aggregate, repos);
  }

  const updatedProduct = await repos.productsRepository.update(id, updateData);
  if (aggregateChanged) await invalidate('catalogue', 'ai-data');
  return toProductDTO(updatedProduct);
}
