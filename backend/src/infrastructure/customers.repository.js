import Customers from './customers.model.js';

export async function list() {
  return [{ id: 1, name: 'Dummy Customer' }];
}