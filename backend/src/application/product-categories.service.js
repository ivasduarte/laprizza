import * as prodCatRepository from '../infrastructure/product-categories.repository.js';

export async function listProductCategories() {
  return prodCatRepository.list();
}