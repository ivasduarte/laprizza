import * as customersService from '../application/customers.service.js';

export async function list(req, res) {
  const customers = await customersService.listCustomers();
  res.status(200).json(customers);
}