import * as productsRepository from '../infrastructure/products.repository.js';
import * as categoriesRepository from '../infrastructure/product-categories.repository.js';
import * as allergensRepository from '../infrastructure/allergen.repository.js';
import * as pizzaComponentTypesRepository from '../infrastructure/pizza-component-type.repository.js';
import { AppError } from './AppError.js';

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
    isActive: product.isActive ?? true,
  };
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
  },
) {
  if (data.sellable && (data.price === undefined || data.price === null || data.price < 0)) {
    throw new AppError('Sellable products must have a valid price.', 400);
  }

  await validateReferences(data, repos);

  const existingProduct = await repos.productsRepository.findByName(data.name);
  if (existingProduct) {
    throw new AppError('A product with this name already exists.', 409);
  }

  const product = await repos.productsRepository.create(data);
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
  },
) {
  const product = await repos.productsRepository.findById(id);
  if (!product) throw new AppError('Product not found.', 404);

  const isSellable = updateData.sellable !== undefined ? updateData.sellable : product.sellable;
  const price = updateData.price !== undefined ? updateData.price : product.price;

  if (isSellable && (price === undefined || price === null || price < 0)) {
    throw new AppError('Sellable products must have a valid price.', 400);
  }

  await validateReferences(updateData, repos);

  if (updateData.pizzaComponentTypeId === null) {
    updateData.pizzaComponentTypeId = null;
  }

  const updatedProduct = await repos.productsRepository.update(id, updateData);
  return toProductDTO(updatedProduct);
}
