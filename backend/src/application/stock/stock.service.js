import * as defaultStockRepository from '../../infrastructure/stock/stock.repository.js';
import * as defaultProductsRepository from '../../infrastructure/products/products.repository.js';
import { nextStockQuantity } from '../../domain/stock/stock.domain.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { toProductDTO } from '../products/products.service.js';
import { invalidate } from '../../infrastructure/cache/cache.js';

export function toStockDTO(stock) {
  return {
    id: stock._id || stock.id,
    productId: stock.productId?._id || stock.productId,
    product: stock.productId ? toProductDTO(stock.productId) : null,
    quantity: stock.quantity,
  };
}

export async function getStockByProductId(
  productId,
  repos = {
    stockRepository: defaultStockRepository,
    productsRepository: defaultProductsRepository,
  },
  { includeInactive = false } = {},
) {
  const product = await repos.productsRepository.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);
  if (product.isActive === false && !includeInactive) throw new AppError('Product not found.', 404);
  if (!product.stockControlled) throw new AppError('Product is not stock controlled.', 400);

  let stock = await repos.stockRepository.findByProductId(productId);
  if (!stock) {
    stock = await repos.stockRepository.create({ productId, quantity: 0 });
    stock.productId = product;
  }
  return toStockDTO(stock);
}

/**
 * Applies a stock movement (WEB04): `increase`/`decrease` by `amount` units, or `set` the
 * counted quantity. The result stays between 0 and MAX_STOCK_QUANTITY.
 * @throws {AppError} 404 product; 400 not stock controlled, STOCK_INVALID_AMOUNT,
 *   STOCK_INVALID_OPERATION, STOCK_NEGATIVE or STOCK_ABOVE_MAXIMUM.
 */
export async function adjustStock(
  productId,
  amount,
  operation,
  repos = {
    stockRepository: defaultStockRepository,
    productsRepository: defaultProductsRepository,
  },
) {
  const product = await repos.productsRepository.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);
  if (!product.stockControlled) throw new AppError('Product is not stock controlled.', 400);

  let stock = await repos.stockRepository.findByProductId(productId);
  if (!stock) {
    stock = await repos.stockRepository.create({ productId, quantity: 0 });
    await invalidate('ai-data');
    stock.productId = product;
  }

  // WEB04: increase/decrease by an amount, or set the counted quantity (no mental arithmetic).
  let newQuantity;
  try {
    newQuantity = nextStockQuantity(stock.quantity, amount, operation);
  } catch (error) {
    if (error instanceof DomainError) throw new AppError(error.message, 400, null, error.code);
    throw error;
  }

  const updatedStock = await repos.stockRepository.updateQuantity(productId, newQuantity);
  await invalidate('ai-data');
  updatedStock.productId = product;
  return toStockDTO(updatedStock);
}

export async function listStock(query = {}, repos = { stockRepository: defaultStockRepository }) {
  const includeInactive = query.includeInactive === true;
  const stocks = await repos.stockRepository.listStock({ search: query.search, includeInactive });
  return stocks
    .filter((s) => s.productId && (includeInactive || s.productId.isActive !== false))
    .map(toStockDTO);
}
