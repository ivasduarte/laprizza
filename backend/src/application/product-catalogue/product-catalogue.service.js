import * as defaultProductsRepository from '../../infrastructure/products/products.repository.js';
import { AppError } from '../app-error.js';
import { cached } from '../../infrastructure/cache/cache.js';

export function toCatalogueDTO(product) {
  return {
    id: product._id || product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.categoryId
      ? {
          id: product.categoryId._id || product.categoryId.id,
          name: product.categoryId.name,
        }
      : null,
    allergens:
      product.allergenIds?.map((a) => ({
        id: a._id || a.id,
        name: a.name,
      })) || [],
    availableSizes:
      product.sizeConfigurations?.map((config) => ({
        pizzaSizeId: config.pizzaSizeId,
        price: config.price,
      })) || [],
  };
}

export async function listCatalogue(
  query = {},
  repos = { productsRepository: defaultProductsRepository },
) {
  return cached('catalogue', ['list', query], 60, async () => {
    const filter = { ...query, isActive: true, sellable: true };
    const products = await repos.productsRepository.listProducts(filter);
    return products.map(toCatalogueDTO);
  });
}

export async function getCatalogueItemById(
  id,
  repos = { productsRepository: defaultProductsRepository },
) {
  return cached('catalogue', ['item', String(id)], 60, async () => {
    const product = await repos.productsRepository.findById(id);

    if (!product || product.isActive === false || product.sellable === false) {
      throw new AppError('Product not found in the catalogue.', 404);
    }

    return toCatalogueDTO(product);
  });
}
