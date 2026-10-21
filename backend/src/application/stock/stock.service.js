import * as defaultStockRepository from '../../infrastructure/stock/stock.repository.js';
import * as defaultProductsRepository from '../../infrastructure/products/products.repository.js';
import { validateStockChange } from '../../domain/stock/stock.domain.js';
import { AppError } from '../app-error.js';
import { DomainError } from '../../domain/domain-error.js';
import { toProductDTO } from '../products/products.service.js';

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
) {
  const product = await repos.productsRepository.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);
  if (!product.stockControlled) throw new AppError('Product is not stock controlled.', 400);

  let stock = await repos.stockRepository.findByProductId(productId);
  if (!stock) {
    stock = await repos.stockRepository.create({ productId, quantity: 0 });
    stock.productId = product;
  }
  return toStockDTO(stock);
}

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
  if (!product) throw new AppError('Product not found.', 400);
  if (!product.stockControlled) throw new AppError('Product is not stock controlled.', 400);

  let validAmount;
  try {
    validAmount = validateStockChange(amount);
  } catch (error) {
    if (error instanceof DomainError) throw new AppError(error.message, 400);
    throw error;
  }

  let stock = await repos.stockRepository.findByProductId(productId);
  if (!stock) {
    stock = await repos.stockRepository.create({ productId, quantity: 0 });
  }

  let newQuantity;
  if (operation === 'increase') {
    newQuantity = stock.quantity + validAmount;
  } else if (operation === 'decrease') {
    newQuantity = stock.quantity - validAmount;
    if (newQuantity < 0)
      throw new AppError('Stock reduction cannot result in a negative quantity', 400);
  } else throw new AppError('Invalid operation. Use increase or decrease.', 400);

  const updatedStock = await repos.stockRepository.updateQuantity(productId, newQuantity);
  updatedStock.productId = product;
  return toStockDTO(updatedStock);
}

export async function listStock(query = {}, repos = { stockRepository: defaultStockRepository }) {
  const stocks = await repos.stockRepository.listStock(query);
  const filteredStocks = stocks.filter((s) => s.productId);
  return filteredStocks.map(toStockDTO);
}
