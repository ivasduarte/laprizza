import * as productsService from '../application/products.service.js';

export async function list(req, res) {
  const products = await productsService.listProducts();
  res.status(200).json(products);
}