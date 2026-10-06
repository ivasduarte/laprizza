import ProductCategories from './product-categories.model.js';

export async function list() {
  return [{ id: 1, name: 'Dummy Product Categories' }];
}