import * as productsRepository from '../infrastructure/products.repository.js';

export async function listProducts() {
  return productsRepository.list();
}