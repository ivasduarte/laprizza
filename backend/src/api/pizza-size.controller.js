import * as sizeService from '../application/pizza-size.service.js';

export async function list(req, res) {
  const pizzaSize = await sizeService.listSizes();
  res.status(200).json(pizzaSize);
}