import Products from './products.model.js';

export async function list() {
  return [{ id: 1, name: 'Dummy Products' }];
}