import * as customersRepository from '../infrastructure/customers.repository.js';

export async function listCustomers() {
  return customersRepository.list();
}