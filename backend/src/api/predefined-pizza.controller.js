import * as predefinedService from '../application/predefined-pizza.service.js';

export async function list(req, res) {
  const predefinedPizza = await predefinedService.listPredefinedPizzas();
  res.status(200).json(predefinedPizza);
}